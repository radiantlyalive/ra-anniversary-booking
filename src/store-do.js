// The Durable Object behind src/lib/store.js. One instance holds all booking state.
// A Durable Object processes one request at a time per instance, so setIfNew is atomic.
import { DurableObject } from 'cloudflare:workers';

export class RaStore extends DurableObject {
  async get(key) { return this.ctx.storage.get(key); }
  async set(key, value) { await this.ctx.storage.put(key, value); }
  async setIfNew(key, value) {
    if ((await this.ctx.storage.get(key)) !== undefined) return false;
    await this.ctx.storage.put(key, value);
    return true;
  }
  async del(key) { await this.ctx.storage.delete(key); }
  async list(prefix) { return [...(await this.ctx.storage.list({ prefix })).keys()]; }
  async clear() { await this.ctx.storage.deleteAll(); }
}
