#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { startLegalApiServer } from './legal-api-server.mjs';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'scripts/legal-api-server.mjs'), 'utf8');
if (!/desarm2003:\s*null/.test(source)) throw new Error('desarm2003 não está configurado como downloader nulo');
if (/desarm2003:\s*['"]scripts\/download-camara\.mjs['"]/.test(source)) throw new Error('desarm2003 ainda exige download de rede');
if (!/desarm2003:\s*['"]scripts\/import-desarm2003\.mjs['"]/.test(source)) throw new Error('importador arquivado do desarm2003 ausente');

const corpus = JSON.parse(await fs.readFile(path.join(root, 'legal/corpus/desarm2003.json'), 'utf8'));
const bytes = await fs.readFile(path.join(root, corpus.sourceFile));
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== corpus.sourceHash) throw new Error('hash do snapshot arquivado não confere');

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-desarm-clean-'));
const dbPath = path.join(tmp, 'clean.db');
await buildLegalDatabase(dbPath);
const { server, db } = await startLegalApiServer(dbPath, 0, '127.0.0.1');
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/legal/norms/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'desarm2003' }),
  });
  const result = await response.json();
  if (response.status !== 200 || result.alreadyInstalled !== true) {
    throw new Error(`instalação limpa inesperada: HTTP ${response.status} ${JSON.stringify(result)}`);
  }
} finally {
  server.close();
  db.close();
  await fs.rm(tmp, { recursive: true, force: true });
}

console.log('CLEAN_DB_DESARM_INSTALL=PASS');
console.log('NETWORK_DOWNLOAD_REQUIRED=FALSE');
console.log('ARCHIVED_OFFICIAL_SNAPSHOT=PASS');
