// Stops a double click or a retried request from booking twice.
// DRAFT: in-memory only. Before sandbox testing, move this to Netlify Blobs so it
// survives across function instances.
const seen = new Map();
export function remember(key, result) { if (key) seen.set(key, { result, at: Date.now() }); return result; }
export function recall(key) { return key ? seen.get(key)?.result : undefined; }
