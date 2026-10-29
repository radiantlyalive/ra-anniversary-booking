// Stripe client. Contributions only, on Stripe-hosted Checkout.
// Live key must be a restricted key that can only create Checkout Sessions.
import { mode } from './http.js';

export async function createCheckout({ amount, currency, bookingRef, memberId, email }) {
  if (mode() === 'mock') {
    return { url: `/demo.html#mock-stripe?amount=${amount}&ref=${encodeURIComponent(bookingRef)}`, id: `cs_mock_${Date.now()}` };
  }
  throw new Error('stripe.createCheckout: not built');
}
export function verifyWebhook(rawBody, signatureHeader) {
  if (mode() === 'mock') return JSON.parse(rawBody);
  throw new Error('stripe.verifyWebhook: not built (use STRIPE_WEBHOOK_SECRET)');
}
