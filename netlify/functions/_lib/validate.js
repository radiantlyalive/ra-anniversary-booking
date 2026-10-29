// Server-side validation. The widget validates the same fields for a faster message,
// but this is the check that counts. Returns error codes, not copy.
export function normaliseWhatsapp(raw) {
  let s = String(raw || '').replace(/[\s().-]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  return s;
}

export function validateGuest(input) {
  const errors = {};
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ');
  const email = String(input?.email || '').trim().toLowerCase();
  const whatsapp = normaliseWhatsapp(input?.whatsapp);

  if (name.length < 2 || name.length > 100 || !/\p{L}/u.test(name)) errors.name = 'name';
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) errors.email = 'email';
  // Country code required: E.164, "+" then 8 to 15 digits, first digit not 0.
  if (!/^\+[1-9]\d{7,14}$/.test(whatsapp)) errors.whatsapp = 'whatsapp';

  return { ok: Object.keys(errors).length === 0, errors, value: { name, email, whatsapp } };
}

export const firstName = (name) => String(name || '').trim().split(' ')[0] || '';
