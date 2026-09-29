// Runs the referee Worker locally as a plain Node HTTP server (no Cloudflare account needed).
//
//   REFEREE_KEY=0x... CONTRACT=0x... node leaderboard/scripts/dev-referee.mjs
//
// Optional: PORT (8787), CHAIN_ID (31337, Hardhat), SEASON (1), ALLOWED_ORIGINS (*).
import http from 'node:http';
import worker from '../referee/src/index.js';

const env = {
  REFEREE_KEY: process.env.REFEREE_KEY,
  CHAIN_ID: process.env.CHAIN_ID || '31337',
  CONTRACT: process.env.CONTRACT,
  SEASON: process.env.SEASON || '1',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
};
if (!env.REFEREE_KEY || !env.CONTRACT) { console.error('set REFEREE_KEY and CONTRACT'); process.exit(2); }
const port = Number(process.env.PORT || 8787);

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const response = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, {
    method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined,
  }), env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`referee listening on http://localhost:${port} (chain ${env.CHAIN_ID}, contract ${env.CONTRACT})`));
