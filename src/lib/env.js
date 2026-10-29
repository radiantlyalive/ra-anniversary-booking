// Mode and env access. BOOKING_MODE: mock (default, no access needed) | sandbox | live.
export const mode = () => process.env.BOOKING_MODE || 'mock';
export const isMock = () => mode() === 'mock';

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
