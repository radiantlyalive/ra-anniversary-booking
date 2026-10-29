// Resolves config for the running mode. Open placeholders are null until Rafa decides.
// mock: demo values fill the gaps. sandbox and live: a null placeholder stops the request.
import * as cfg from '../../../config/event.config.js';
import { demoValues } from '../../../config/demo.values.js';
import { isMock } from './env.js';
import { toUtcIso } from './time.js';

export class ConfigError extends Error {
  constructor(missing) { super(`Waiting on Rafa: ${missing.join(', ')}`); this.code = 'not_configured'; this.missing = missing; }
}

export function resolve({ mock = isMock(), values = cfg.open } = {}) {
  const missing = [];
  const out = {};
  for (const [k, o] of Object.entries(values)) {
    let v = o.value;
    if (v === null && mock) v = demoValues[k];
    if (v === null || v === undefined) missing.push(`${k} (${o.id})`);
    out[k] = v;
  }
  if (missing.length) throw new ConfigError(missing);

  const sessions = out.singleSessions.list.map((s) => ({ ...s }));
  return {
    event: cfg.event,
    fullDay: cfg.fullDay,
    tags: cfg.momenceTags,
    limits: cfg.limits,
    mock,
    bookingOpensAt: toUtcIso(out.bookingOpens),
    sessions,
    waitlistPerSession: !!out.singleSessions.waitlistPerSession,
    contributions: { ...out.contributions, ...out.amounts },
    classCredit: out.classCredit,
    mealPackage: out.mealPackage,
    reconfirm: {
      ...out.reconfirm,
      emailAt: out.reconfirm.emailAt && toUtcIso(out.reconfirm.emailAt),
      reminderAt: out.reconfirm.reminderAt && toUtcIso(out.reconfirm.reminderAt),
      deadlineAt: toUtcIso(out.reconfirm.deadlineAt),
      finalConfirmAt: out.reconfirm.finalConfirmAt ? toUtcIso(out.reconfirm.finalConfirmAt) : null,
    },
    eventPageUrl: out.eventPageUrl,
  };
}

export const getConfig = () => resolve();

// All bookable keys with their label, for Momence mapping and Klaviyo properties.
export const sessionByKey = (c, key) =>
  key === c.fullDay.key ? { key, label: 'Full Day', capacity: c.fullDay.capacity, momenceSessionId: c.fullDay.momenceSessionId } : c.sessions.find((s) => s.key === key);
