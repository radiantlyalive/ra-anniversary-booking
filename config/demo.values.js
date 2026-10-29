// MOCK MODE ONLY. These values let the local demo and the tests run. They are NOT
// decisions and must never be copied into production config without Rafa's approval.
// Loaded only when BOOKING_MODE=mock. Every value is deliberately neutral.

export const demoValues = {
  bookingOpens: '2020-01-01T00:00:00+08:00', // demo: already open
  singleSessions: {
    waitlistPerSession: true,
    list: [
      { key: 'demo-a', label: 'Demo session A', time: '09:00 to 10:30', place: '', capacity: 30,   momenceSessionId: null },
      { key: 'demo-b', label: 'Demo session B', time: '11:00 to 12:30', place: '', capacity: null, momenceSessionId: null },
      { key: 'demo-c', label: 'Demo session C', time: '15:00 to 16:15', place: '', capacity: 2,    momenceSessionId: null }, // small cap to show a per-session waitlist
    ],
  },
  contributions: { word: 'donation', recipientLine: 'Demo recipient line', productName: 'Demo contribution product' },
  classCredit: { enabled: false },
  reconfirm: {
    emailAt:    '2026-11-26T09:00:00+08:00',
    reminderAt: '2026-11-27T09:00:00+08:00',
    deadlineAt: '2026-11-28T12:00:00+08:00',
    finalConfirmAt: null,
    release: 'automatic',
  },
  mealPackage: { enabled: false, priceIdr: null },
  amounts: { currency: 'IDR', suggestedAmounts: [100000, 250000, 500000], refundWording: 'Demo refund wording.', contributorsKeepSpotIfNoReconfirm: true },
  eventPageUrl: `http://localhost:${process.env.PORT || 8888}/demo.html`,
};
