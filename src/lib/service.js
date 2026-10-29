// Booking logic shared by the functions. Functions stay thin: they parse the request, call
// one of these, and turn the result into a response. Everything here is plain async code
// so the tests can run the whole flow with no HTTP.
//
// Records (store):
//   bk:{ref}        booking group: one guest, one Full Day item OR one or more single-session items
//   email:{email}   list of refs for that email (duplicate guard)
//   mb:{id}         Momence booking id -> ref
import * as store from './store.js';
import * as momence from './momence.js';
import * as klaviyo from './klaviyo.js';
import * as stripe from './stripe.js';
import { getConfig, sessionByKey } from './config.js';
import { validateGuest, firstName } from './validate.js';
import { nowMs, formatBali, formatBaliDate } from './time.js';
import { signToken, newRef } from './signing.js';
import { isMock } from './env.js';

const { EVENTS } = klaviyo;
const baseUrl = () => process.env.PUBLIC_BASE_URL || process.env.URL || `http://localhost:${process.env.PORT || 8888}`;
const profileOf = (r) => ({ email: r.email, whatsapp: r.whatsapp, firstName: firstName(r.name) });
const getRec = (ref) => store.get(`bk:${ref}`);
const putRec = (r) => store.set(`bk:${r.ref}`, r);
const FULL = (cfg) => cfg.fullDay.key;
const fullItem = (cfg, r) => r.items.find((i) => i.key === FULL(cfg));

export const reconfirmUrl = (cfg, ref) =>
  `${baseUrl()}/api/reconfirm?t=${signToken({ ref, expiresAtMs: Date.parse(cfg.reconfirm.deadlineAt) })}`;

// ---------------------------------------------------------------- public config and spots
export async function bookingOpen(cfg = getConfig()) {
  return (await nowMs()) >= Date.parse(cfg.bookingOpensAt);
}

export async function publicState() {
  const cfg = getConfig();
  const [fd, ...singles] = await Promise.all([FULL(cfg), ...cfg.sessions.map((s) => s.key)].map((k) => momence.getSession(k)));
  const open = await bookingOpen(cfg);
  return {
    mode: cfg.mock ? 'mock' : 'live',
    bookingOpen: open,
    opensAtDisplay: formatBaliDate(cfg.bookingOpensAt),
    eventDateDisplay: formatBali(`${cfg.event.date}T00:00:00+08:00`, { hour: undefined, minute: undefined, year: 'numeric' }),
    deadlineDisplay: formatBali(cfg.reconfirm.deadlineAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' (Bali time)',
    deadlineDateDisplay: formatBaliDate(cfg.reconfirm.deadlineAt),
    fullDay: { capacity: fd.capacity, booked: fd.booked, left: fd.left, waiting: fd.waiting, full: fd.left === 0 },
    sessions: cfg.sessions.map((s, i) => ({
      key: s.key, label: s.label, time: s.time, place: s.place || '', capacity: s.capacity,
      left: singles[i].left, full: singles[i].left === 0, waitlist: cfg.waitlistPerSession,
    })),
    contributions: {
      currency: cfg.contributions.currency,
      suggestedAmounts: cfg.contributions.suggestedAmounts,
      minimum: cfg.limits.minimumOtherAmount,
      word: cfg.contributions.word,
      recipientLine: cfg.contributions.recipientLine,
      refundWording: cfg.contributions.refundWording,
    },
    features: { classCredit: !!cfg.classCredit.enabled, mealPackage: !!cfg.mealPackage.enabled },
  };
}

// ---------------------------------------------------------------- booking
const activeStatuses = new Set(['booked', 'waitlisted']);

async function recordsForEmail(email) {
  const refs = (await store.get(`email:${email}`)) || [];
  return (await Promise.all(refs.map(getRec))).filter(Boolean);
}

function summarise(cfg, rec, intent) {
  const items = rec.items.map((i) => ({ key: i.key, label: sessionByKey(cfg, i.key)?.label || i.key, status: i.status }));
  const booked = items.filter((i) => i.status === 'booked').length;
  const waiting = items.filter((i) => i.status === 'waitlisted').length;
  const status = booked && !waiting && booked === items.length ? 'booked' : booked ? 'partial' : waiting ? 'waitlisted' : 'unavailable';
  return {
    status, bookingRef: rec.ref, items,
    next: intent === 'donate' && booked ? 'amount' : 'done',
    firstName: firstName(rec.name),
  };
}

// input: { type, sessions?, name, email, whatsapp, wholeDay?, intent }
export async function createBooking(input) {
  const cfg = getConfig();
  if (!(await bookingOpen(cfg))) return { status: 403, body: { error: 'closed' } };

  const g = validateGuest(input);
  const fields = { ...g.errors };
  const type = input.type === 'single' ? 'single' : input.type === 'full-day' ? 'full-day' : null;
  if (!type) return { status: 422, body: { error: 'validation', fields: { type: 'type' } } };
  let keys;
  if (type === 'full-day') {
    if (cfg.fullDay.requireWholeDayTick && input.wholeDay !== true) fields.wholeDay = 'wholeDay';
    keys = [FULL(cfg)];
  } else {
    const valid = new Set(cfg.sessions.map((s) => s.key));
    keys = [...new Set(Array.isArray(input.sessions) ? input.sessions : [])].filter((k) => valid.has(k));
    if (!keys.length) fields.sessions = 'sessions';
  }
  if (Object.keys(fields).length) return { status: 422, body: { error: 'validation', fields } };
  const intent = input.intent === 'donate' ? 'donate' : 'free';
  const guest = g.value;

  // Duplicate guard: the same email never holds the same session twice.
  const existing = await recordsForEmail(guest.email);
  const held = new Set(existing.flatMap((r) => r.items.filter((i) => activeStatuses.has(i.status)).map((i) => i.key)));
  const fresh = keys.filter((k) => !held.has(k));
  if (!fresh.length) {
    const rec = existing.find((r) => r.items.some((i) => keys.includes(i.key) && activeStatuses.has(i.status)));
    return { status: 200, body: { ...summarise(cfg, rec, intent), duplicate: true } };
  }

  const { id: memberId } = await momence.findOrCreateMember(guest);
  const rec = { ref: newRef(), ...guest, memberId, type, intent, items: [], donor: false, confirmed: false, createdAt: new Date(await nowMs()).toISOString() };

  for (const key of fresh) {
    const b = await momence.book({ memberId, sessionKey: key });
    if (b.ok) {
      rec.items.push({ key, status: 'booked', momenceBookingId: b.bookingId });
      await store.set(`mb:${b.bookingId}`, rec.ref);
      continue;
    }
    const canWait = key === FULL(cfg) ? cfg.fullDay.waitlist : cfg.waitlistPerSession;
    if (b.reason === 'full' && canWait) {
      const w = await momence.joinWaitlist({ memberId, sessionKey: key });
      rec.items.push({ key, status: 'waitlisted', entryId: w.entryId });
    } else {
      rec.items.push({ key, status: 'unavailable' });
    }
  }
  await putRec(rec);
  await store.set(`email:${guest.email}`, [...existing.map((r) => r.ref), rec.ref]);

  const label = (i) => sessionByKey(cfg, i.key)?.label || i.key;
  const booked = rec.items.filter((i) => i.status === 'booked');
  const waiting = rec.items.filter((i) => i.status === 'waitlisted');
  if (booked.length) {
    await klaviyo.track(EVENTS.booked, profileOf(rec), {
      booking_ref: rec.ref, booking_type: type, sessions: booked.map(label), intent,
      ...(type === 'full-day' ? { reconfirm_url: reconfirmUrl(cfg, rec.ref), reconfirm_deadline: cfg.reconfirm.deadlineAt } : {}),
    }, `booked:${rec.ref}`);
  }
  if (waiting.length) {
    await klaviyo.track(EVENTS.waitlisted, profileOf(rec), { booking_ref: rec.ref, booking_type: type, sessions: waiting.map(label) }, `waitlisted:${rec.ref}`);
  }

  const out = summarise(cfg, rec, intent);
  if (out.status === 'unavailable') return { status: 409, body: { error: 'session_full', items: out.items } };
  return { status: 201, body: out };
}

// ---------------------------------------------------------------- contribution
export async function startContribution({ bookingRef, amount }, idempotencyKey) {
  const cfg = getConfig();
  const rec = await getRec(bookingRef);
  if (!rec || !rec.items.some((i) => i.status === 'booked')) return { status: 404, body: { error: 'not_found' } };
  const n = Number(amount);
  if (!Number.isInteger(n) || n < cfg.limits.minimumOtherAmount || n > cfg.limits.maximumAmount) {
    return { status: 422, body: { error: 'validation', fields: { amount: 'amount' } } };
  }
  const sep = cfg.eventPageUrl.includes('?') ? '&' : '?';
  const co = await stripe.createCheckout({
    amount: n, currency: cfg.contributions.currency, productName: cfg.contributions.productName,
    bookingRef: rec.ref, email: rec.email,
    successUrl: `${cfg.eventPageUrl}${sep}ra=paid`, cancelUrl: `${cfg.eventPageUrl}${sep}ra=cancelled`,
    idempotencyKey: `contribute-${idempotencyKey}`,
  });
  rec.donation = { checkoutId: co.id, amount: n, currency: cfg.contributions.currency, status: 'open' };
  await putRec(rec);
  return { status: 200, body: { checkoutUrl: co.url } };
}

// A guest who abandons Stripe keeps the free spot: nothing is undone anywhere.

// Stripe "paid": tag the guest in Momence, send "Contributed". Each step is flagged so a retry
// after a partial failure repeats only what is missing.
export async function handleStripeEvent(event) {
  const paidTypes = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  const obj = event?.data?.object;
  if (!paidTypes.includes(event?.type) || obj?.payment_status !== 'paid') return { status: 200, body: { received: true, ignored: true } };

  const cfg = getConfig();
  const ref = obj.metadata?.booking_ref || obj.client_reference_id;
  const rec = ref && (await getRec(ref));
  if (!rec) { console.warn('stripe-webhook: no booking for', ref); return { status: 200, body: { received: true, unmatched: true } }; }

  const currency = (obj.currency || cfg.contributions.currency).toUpperCase();
  const amount = stripe.fromMinorUnits(obj.amount_total, currency);
  rec.donor = true;
  rec.donation = { ...(rec.donation || {}), amount, currency, status: 'paid', paidSessionId: obj.id };
  await putRec(rec);

  if (!rec.donorTagged) { await momence.addTag({ memberId: rec.memberId, tag: cfg.tags.donor }); rec.donorTagged = true; await putRec(rec); }
  if (!rec.contributedSent) {
    await klaviyo.track(EVENTS.contributed, profileOf(rec), { booking_ref: rec.ref, amount, currency }, `contributed:${obj.id}`);
    rec.contributedSent = true; await putRec(rec);
  }
  return { status: 200, body: { received: true } };
}

// ---------------------------------------------------------------- Momence webhooks
// Normalised event: { type: 'booked'|'cancelled', bookingId, sessionKey, member: { id, name?, email?, whatsapp? } }
export async function handleMomenceEvent(ev) {
  const cfg = getConfig();
  if (!sessionByKey(cfg, ev.sessionKey)) return { status: 200, body: { ignored: 'not_an_anniversary_session' } }; // the studio has other classes

  if (ev.type === 'booked') {
    if (await store.get(`mb:${ev.bookingId}`)) return { status: 200, body: { duplicate: true } };
    const refs = (await store.list('bk:')).map((k) => k.slice(3));
    const recs = (await Promise.all(refs.map(getRec))).filter(Boolean);
    const waiting = recs.find((r) =>
      (r.memberId === ev.member.id || (ev.member.email && r.email === ev.member.email.toLowerCase())) &&
      r.items.some((i) => i.key === ev.sessionKey && i.status === 'waitlisted'));
    if (waiting) {
      const item = waiting.items.find((i) => i.key === ev.sessionKey && i.status === 'waitlisted');
      item.status = 'booked'; item.momenceBookingId = ev.bookingId;
      await putRec(waiting); await store.set(`mb:${ev.bookingId}`, waiting.ref);
      await klaviyo.track(EVENTS.movedUp, profileOf(waiting), {
        booking_ref: waiting.ref, session: sessionByKey(cfg, ev.sessionKey).label,
        ...(ev.sessionKey === FULL(cfg) ? { reconfirm_url: reconfirmUrl(cfg, waiting.ref), reconfirm_deadline: cfg.reconfirm.deadlineAt } : {}),
      }, `movedup:${ev.bookingId}`);
      return { status: 200, body: { movedUp: waiting.ref } };
    }
    // Front-desk booking: keep Klaviyo complete. Needs an email to be useful.
    if (!ev.member.email) return { status: 200, body: { ignored: 'no_email' } };
    const rec = {
      ref: newRef(), name: ev.member.name || '', email: ev.member.email.toLowerCase(), whatsapp: ev.member.whatsapp || '', memberId: ev.member.id,
      type: ev.sessionKey === FULL(cfg) ? 'full-day' : 'single', intent: 'free', source: 'momence', donor: false, confirmed: false,
      items: [{ key: ev.sessionKey, status: 'booked', momenceBookingId: ev.bookingId }], createdAt: new Date(await nowMs()).toISOString(),
    };
    await putRec(rec); await store.set(`mb:${ev.bookingId}`, rec.ref);
    const ex = (await store.get(`email:${rec.email}`)) || [];
    await store.set(`email:${rec.email}`, [...ex, rec.ref]);
    await klaviyo.track(EVENTS.booked, profileOf(rec), {
      booking_ref: rec.ref, booking_type: rec.type, sessions: [sessionByKey(cfg, ev.sessionKey).label], source: 'front-desk',
      ...(rec.type === 'full-day' ? { reconfirm_url: reconfirmUrl(cfg, rec.ref), reconfirm_deadline: cfg.reconfirm.deadlineAt } : {}),
    }, `booked:${rec.ref}`);
    return { status: 200, body: { registered: rec.ref } };
  }

  if (ev.type === 'cancelled') {
    const ref = await store.get(`mb:${ev.bookingId}`);
    const rec = ref && (await getRec(ref));
    const item = rec?.items.find((i) => i.momenceBookingId === ev.bookingId);
    if (!item || item.status !== 'booked') return { status: 200, body: { noop: true } }; // our own release is already recorded
    item.status = 'cancelled';
    await putRec(rec);
    await klaviyo.track(EVENTS.cancelled, profileOf(rec), { booking_ref: rec.ref, session: sessionByKey(cfg, item.key).label }, `cancelled:${ev.bookingId}`);
    return { status: 200, body: { cancelled: rec.ref } };
  }
  return { status: 200, body: { ignored: 'unknown_type' } };
}

// ---------------------------------------------------------------- reconfirm
// state: pending | confirmed | released | closed | none
export async function reconfirmState(ref) {
  const cfg = getConfig();
  const rec = await getRec(ref);
  const item = rec && fullItem(cfg, rec);
  if (!item) return { state: 'none' };
  const view = { rec, item, firstName: firstName(rec.name), cfg };
  if (item.status === 'released') return { ...view, state: 'released' };
  if (item.status !== 'booked') return { ...view, state: 'none' };
  if (rec.confirmed) return { ...view, state: 'confirmed' };
  if ((await nowMs()) > Date.parse(cfg.reconfirm.deadlineAt)) return { ...view, state: 'closed' };
  return { ...view, state: 'pending' };
}

export async function confirmSpot(ref) {
  const v = await reconfirmState(ref);
  if (v.state !== 'pending') return v;
  await momence.addTag({ memberId: v.rec.memberId, tag: v.cfg.tags.confirmed });
  v.rec.confirmed = true; await putRec(v.rec);
  await klaviyo.track(EVENTS.confirmed, profileOf(v.rec), { booking_ref: ref }, `confirmed:${ref}`);
  return { ...v, state: 'confirmed' };
}

// Cancels the Full Day booking in Momence and tells Klaviyo. In Momence the waitlist moves up
// (to be confirmed by check 3); in the mock, the promoted guests come back from cancelBooking.
export async function releaseSpot(ref, { reason = 'guest', skipStateCheck = false } = {}) {
  const v = await reconfirmState(ref);
  if (!skipStateCheck && !['pending', 'confirmed'].includes(v.state)) return v;
  if (!v.item || v.item.status !== 'booked') return v;
  const r = await momence.cancelBooking({ bookingId: v.item.momenceBookingId });
  v.item.status = 'released'; v.item.releasedBy = reason;
  await putRec(v.rec);
  await klaviyo.track(EVENTS.released, profileOf(v.rec), { booking_ref: ref, reason }, `released:${ref}`);
  for (const p of r.promoted || []) {
    await handleMomenceEvent({ type: 'booked', bookingId: p.bookingId, sessionKey: p.sessionKey, member: { id: p.memberId } });
  }
  return { ...v, state: 'released' };
}

// ---------------------------------------------------------------- deadline job
// Runs every 15 minutes and acts once, after reconfirm.deadlineAt. Skips confirmed guests,
// and contributors when contributorsKeepSpotIfNoReconfirm is true. Never touches single sessions.
// release 'team-review' only builds the list. A failed release leaves the job not done, so the
// next tick retries (releasing is idempotent).
export async function runDeadline() {
  const cfg = getConfig();
  if ((await nowMs()) < Date.parse(cfg.reconfirm.deadlineAt)) return { ran: false, reason: 'not_due' };
  if (await store.get('deadline:done')) return { ran: false, reason: 'already_done' };

  const out = { ran: true, released: [], skippedConfirmed: [], skippedContributors: [], review: [], errors: [] };
  // Decide who is eligible ONCE, before releasing anyone, and keep that list for retries. A guest
  // the waitlist moves up during the run is therefore never released by this job.
  let plan = await store.get('deadline:plan');
  if (!plan) {
    plan = { toRelease: [], review: [], skippedConfirmed: [], skippedContributors: [] };
    for (const ref of (await store.list('bk:')).map((k) => k.slice(3))) {
      const rec = await getRec(ref);
      const item = rec && fullItem(cfg, rec);
      if (!item || item.status !== 'booked') continue;
      if (rec.confirmed) { plan.skippedConfirmed.push(ref); continue; }
      if (rec.donor && cfg.contributions.contributorsKeepSpotIfNoReconfirm) { plan.skippedContributors.push(ref); continue; }
      if (cfg.reconfirm.release === 'team-review') { plan.review.push({ ref, name: rec.name, email: rec.email }); continue; }
      plan.toRelease.push(ref);
    }
    await store.set('deadline:plan', plan);
  }
  out.skippedConfirmed = plan.skippedConfirmed; out.skippedContributors = plan.skippedContributors; out.review = plan.review;
  for (const ref of plan.toRelease) {
    const v = await reconfirmState(ref);
    if (v.item?.status !== 'booked') { out.released.push(ref); continue; } // released by an earlier run or by the guest
    try { await releaseSpot(ref, { reason: 'deadline', skipStateCheck: true }); out.released.push(ref); } catch (e) { out.errors.push({ ref, error: String(e.message || e) }); }
  }
  if (!out.errors.length) await store.set('deadline:done', { at: new Date(await nowMs()).toISOString(), released: out.released.length, review: out.review.length });
  if (out.review.length) await store.set('deadline:review', out.review);
  return out;
}

export const isMockMode = isMock;
