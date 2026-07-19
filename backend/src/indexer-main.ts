import { catchUp, start } from './indexer.js';
import { getCursor } from './db.js';

const once = process.argv.includes('--once');

if (once) {
  const head = await catchUp();
  console.log(`[indexer] backfill complete. cursor=${getCursor()} head=${head}`);
  process.exit(0);
} else {
  await start();
}
