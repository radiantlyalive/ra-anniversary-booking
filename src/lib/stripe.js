// Stripe client. Contributions only, on Stripe-hosted Checkout, no SDK (plain fetch + node crypto).
// Live key must be a restricted key that can only create Checkout Sessions.
// Checked against the Stripe docs on 2026-10-29 (top-level Checkout fields, IDR minor units, webhook signature).
// Not visible in the fetched docs: price_data and product_data nested fields, and the Idempotency-Key header.
// Run once with a sandbox key before trusting it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isMock, requireEnv } from './env.js';

// Currencies Stripe counts in whole units. Everything else is 2-decimal, including IDR (confirmed in the
// Stripe currencies docs): IDR 10,000 is sent as 1000000. UGX and ISK are 2-decimal in the API, so they are
// not listed. The docs page did not expose the full zero-decimal list: re-check it before adding a currency.
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
export const toMinorUnits = (amount, currency) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount * 100);
export const fromMinorUnits = (minor, currency) => (ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100);

export async function createCheckout({ amount, currency, productName, bookingRef, email, successUrl, cancelUrl, idempotencyKey }) {
  if (isMock()) {
    const u = new URL('/mock-stripe.html', 'http://localhost');
    u.searchParams.set('ref', bookingRef);
    u.searchParams.set('amount', String(amount));
    u.searchParams.set('currency', currency);
    u.searchParams.set('success', successUrl);
    u.searchParams.set('cancel', cancelUrl);
    return { id: `cs_mock_${bookingRef}`, url: u.pathname + u.search };
  }
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(toMinorUnits(amount, currency)),
    'line_items[0][price_data][product_data][name]': productName,
    client_reference_id: bookingRef,
    'metadata[booking_ref]': bookingRef,
    customer_email: email,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${requireEnv('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': idempotencyKey },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status}`);
  const j = await res.json();
  return { id: j.id, url: j.url };
}

// Stripe-Signature: t=<unix>,v1=<hex hmac sha256 of "<t>.<raw body>">. Rejects old timestamps.
export function verifyWebhook(rawBody, signatureHeader, { secret = process.env.STRIPE_WEBHOOK_SECRET, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (isMock() && !secret) return JSON.parse(rawBody); // mock mode, no secret configured: no signature to check
  if (!secret) throw new Error('Missing env var STRIPE_WEBHOOK_SECRET');
  // The header can carry several v1 signatures (secret roll keeps the old secret live for 24 hours). Any one may match. Other schemes (v0 test) are ignored.
  const pairs = String(signatureHeader || '').split(',').map((p) => p.trim().split('='));
  const t = Number(pairs.find(([k]) => k === 't')?.[1]);
  const v1 = pairs.filter(([k, v]) => k === 'v1' && v).map(([, v]) => v);
  if (!t || !v1.length) throw badSig();
  if (Math.abs(nowSec - t) > toleranceSec) throw badSig();
  const want = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  const match = v1.some((sig) => {
    const got = Buffer.from(sig, 'hex');
    return got.length === want.length && timingSafeEqual(got, want);
  });
  if (!match) throw badSig();
  return JSON.parse(rawBody);
}
const badSig = () => Object.assign(new Error('bad_signature'), { code: 'bad_signature' });

// Used by tests and the mock Stripe page to make a correctly signed header.
export const signPayload = (rawBody, secret, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
