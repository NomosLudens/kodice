#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
    passed++;
  } catch (error) {
    console.error(`not ok - ${name}: ${error.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-legal-api-test-'));
const testDbPath = path.join(tmpDir, 'test-legal-api.db');

await buildLegalDatabase(testDbPath);
const { server, db, port, host } = await startLegalApiServer(testDbPath, 0, '127.0.0.1');
const baseUrl = `http://${host}:${server.address().port}`;

try {
  // 1. Health endpoint
  await test('HEALTH_ENDPOINT: responde status ok em /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert(res.status === 200, `Status deve ser 200, recebido ${res.status}`);
    const json = await res.json();
    assert(json.status === 'ok', `status deve ser ok, recebido ${json.status}`);
  });

  // 2. Norm endpoint
  await test('NORM_ENDPOINT: recupera metadados da norma cpc2015', async () => {
    const res = await fetch(`${baseUrl}/api/legal/norms/cpc2015`);
    assert(res.status === 200, `Status deve ser 200, recebido ${res.status}`);
    const norm = await res.json();
    assert(norm.id === 'cpc2015', 'id deve ser cpc2015');
    assert(norm.number === '13105', 'number deve ser 13105');
    assert(norm.status === 'vigente', 'status deve ser vigente');
  });

  // 3. Article 300 lookup
  await test('ARTICLE_300_API: recupera Art. 300 via API privada', async () => {
    const res = await fetch(`${baseUrl}/api/legal/norms/cpc2015/units/art300`);
    assert(res.status === 200, `Status deve ser 200, recebido ${res.status}`);
    const unit = await res.json();
    assert(unit.normId === 'cpc2015', 'normId deve ser cpc2015');
    assert(unit.canonicalPath === 'art300', 'canonicalPath deve ser art300');
    assert(unit.kind === 'artigo', 'kind deve ser artigo');
    assert(unit.text.includes('tutela de urgência será concedida'), 'Texto deve conter redação oficial do Art. 300');
  });

  // 4. Parágrafo 1 do Art. 300 lookup
  await test('ARTICLE_300_PAR1_API: recupera § 1º do Art. 300', async () => {
    const res = await fetch(`${baseUrl}/api/legal/norms/cpc2015/units/art300-par1`);
    assert(res.status === 200, `Status deve ser 200, recebido ${res.status}`);
    const unit = await res.json();
    assert(unit.canonicalPath === 'art300-par1', 'canonicalPath deve ser art300-par1');
    assert(unit.parentId === 'cpc2015-art300', 'parentId deve ser cpc2015-art300');
    assert(unit.text.includes('exigir caução real ou fidejussória'), 'Texto deve conter redação oficial do § 1º');
  });

  // 5. Unidade inexistente retorna 404
  await test('NOT_FOUND_API: unidade inexistente retorna 404', async () => {
    const res = await fetch(`${baseUrl}/api/legal/norms/cpc2015/units/art9999`);
    assert(res.status === 404, `Status deve ser 404, recebido ${res.status}`);
  });

} finally {
  server.close();
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
