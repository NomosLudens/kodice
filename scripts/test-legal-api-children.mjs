import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-legal-children-'));
const testDbPath = path.join(tmpDir, 'test.db');

await buildLegalDatabase(testDbPath);
const { server, db } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const base = `http://127.0.0.1:${server.address().port}`;

const checks = [];
function check(cond, msg) { checks.push([cond, msg]); if (!cond) console.error('FAIL', msg); }

try {
  // Lista normas
  const r1 = await fetch(`${base}/api/legal/norms`);
  check(r1.status === 200, `GET /api/legal/norms status: ${r1.status}`);
  const norms = await r1.json();
  // O corpus cresceu: cf88 + cpc2015 + 8 códigos federais (CC/CP/CPP/CDC/CLT/CTN/ECA/LGPD).
  // Esta assertion é apenas sobre cpc2015 estar disponível.
  check(Array.isArray(norms) && norms.length >= 1 && norms.some(n => n.id === 'cpc2015'), `Lista normas inclui cpc2015 (got ${norms.length} norms)`);

  // Filhos da raiz
  const r2 = await fetch(`${base}/api/legal/norms/cpc2015/children`);
  check(r2.status === 200, `children raiz status: ${r2.status}`);
  const raiz = await r2.json();
  check(raiz.length >= 1, `raiz tem filhos (got ${raiz.length})`);
  const preambulo = raiz.find(u => u.canonicalPath === 'preambulo');
  check(preambulo, 'preambulo presente na raiz');

  // Filhos de art300 (3 paragrafos)
  const r3 = await fetch(`${base}/api/legal/norms/cpc2015/children?parent=art300`);
  check(r3.status === 200, `children art300 status: ${r3.status}`);
  const art300Children = await r3.json();
  check(art300Children.length === 3, `Art. 300 deve ter 3 paragrafos (got ${art300Children.length})`);
  check(art300Children.every(c => c.kind === 'paragrafo'), 'todos filhos do Art. 300 são paragrafos');

  // 404
  const r4 = await fetch(`${base}/api/legal/norms/cpc2015/children?parent=art9999`);
  check(r4.status === 404, `parent inexistente 404: ${r4.status}`);

  const passed = checks.filter(([ok]) => ok).length;
  console.log(`\n${passed}/${checks.length} checks`);
  if (passed !== checks.length) process.exit(1);
} finally {
  server.close(); db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}