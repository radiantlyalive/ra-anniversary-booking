// Momence client facade. Calls take the anniversary session KEY (config), never a Momence id:
// the real client maps keys to Momence session ids from config.
//
//   getSession({key})                 -> { capacity, booked, left, waiting }
//   findOrCreateMember({name,email,whatsapp}) -> { id }
//   book({memberId, sessionKey})      -> { ok, bookingId } | { ok:false, reason:'full' }
//   joinWaitlist({memberId, sessionKey}) -> { ok, entryId, position }
//   cancelBooking({bookingId})        -> { ok, promoted: [{memberId, bookingId, sessionKey}] }
//   addTag({memberId, tag})           -> { ok }
import { isMock } from './env.js';
import * as mock from './momence-mock.js';
import * as real from './momence-real.js';

const impl = () => (isMock() ? mock : real);

export const getSession = (key) => impl().getSession(key);
export const findOrCreateMember = (g) => impl().findOrCreateMember(g);
export const book = (a) => impl().book(a);
export const joinWaitlist = (a) => impl().joinWaitlist(a);
export const cancelBooking = (a) => impl().cancelBooking(a);
export const addTag = (a) => impl().addTag(a);
export { mock };
