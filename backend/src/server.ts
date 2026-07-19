import { buildApi } from './api.js';
import { start as startIndexer } from './indexer.js';
import { config } from './config.js';

const app = await buildApi();

if (config.indexerEnabled) {
  await startIndexer();
}

await app.listen({ port: config.port, host: config.host });
console.log(`[api] listening on http://${config.host}:${config.port} (chain ${config.chainId})`);
if (config.host === '0.0.0.0') {
  console.log('[api] NOTE: bound to 0.0.0.0 and unauthenticated. It serves only public, read-only');
  console.log('[api]       on-chain data. Put it behind a reverse proxy / firewall for production.');
}

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
