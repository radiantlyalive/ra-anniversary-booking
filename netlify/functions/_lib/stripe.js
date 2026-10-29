// Stripe client. Contributions only, on Stripe-hosted Checkout, no SDK (plain fetch + node crypto).
// Live key must be a restricted key that can only create Checkout Sessions.
// UNVERIFIED against a real Stripe account: the request fields below follow the Checkout
// Sessions API as the author knows it. Run once with a sandbox key before trusting it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isMock, requireEnv } from './env.js';

// Currencies Stripe counts in whole units. Everything else is 2-decimal, including IDR:
// IDR 10,000 is sent as 1000000. CONFIRM IN SANDBOX before launch.
const ZERO_DECIMAL = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
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
  const parts = Object.fromEntries(String(signatureHeader || '').split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  if (!t || !parts.v1) throw badSig();
  if (Math.abs(nowSec - t) > toleranceSec) throw badSig();
  const want = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  const got = Buffer.from(parts.v1, 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw badSig();
  return JSON.parse(rawBody);
}
const badSig = () => Object.assign(new Error('bad_signature'), { code: 'bad_signature' });

// Used by tests and the mock Stripe page to make a correctly signed header.
export const signPayload = (rawBody, secret, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`;
