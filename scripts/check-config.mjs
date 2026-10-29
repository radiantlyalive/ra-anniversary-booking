// Lists every decision still waiting on Rafa. Exits 1 while any is open, so a deploy to
// sandbox or live can be blocked on it. Run: npm run check:config
import { openItems, open } from '../config/event.config.js';
const items = openItems(open);
for (const i of items) console.log(`${i.filled ? 'decided ' : 'WAITING '} ${i.id.padEnd(6)} ${i.path}: ${i.note}`);
const waiting = items.filter((i) => !i.filled).length;
console.log(`\n${waiting} of ${items.length} waiting on Rafa.`);
process.exit(waiting ? 1 : 0);
