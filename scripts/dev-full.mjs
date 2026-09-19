#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const dbPath = process.env.KODICE_LEGAL_DB || path.resolve(rootDir, 'legal.db');
const port = process.env.KODICE_LEGAL_PORT || '4520';
const host = process.env.KODICE_LEGAL_HOST || '127.0.0.1';

console.log('=== KÓDICE — AMBIENTE DE DESENVOLVIMENTO INTEGRADO ===\n');

if (!existsSync(dbPath)) {
  console.warn(`[AVISO] Banco SQLite "${dbPath}" não foi encontrado.`);
  console.warn('Para gerar o banco a partir do corpus oficial (61 normas), execute:');
  console.warn('  bun run reproduce:verify\n');
}

const apiProcess = spawn('node', ['scripts/legal-api-server.mjs'], {
  cwd: rootDir,
  env: {
    ...process.env,
    KODICE_LEGAL_DB: dbPath,
    KODICE_LEGAL_PORT: port,
    KODICE_LEGAL_HOST: host,
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

apiProcess.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
apiProcess.stderr.on('data', (d) => process.stderr.write(`[api:err] ${d}`));

// Detect runner (bun or npx/node)
const isBun = typeof process.versions.bun !== 'undefined' || process.env.npm_config_user_agent?.includes('bun');
const webCmd = isBun ? 'bun' : 'npx';
const webArgs = isBun ? ['run', 'dev'] : ['vite'];

const webProcess = spawn(webCmd, webArgs, {
  cwd: rootDir,
  env: {
    ...process.env,
    VITE_KODICE_LEGAL_API_URL: `http://${host}:${port}/api/legal`,
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

webProcess.stdout.on('data', (d) => process.stdout.write(`[web] ${d}`));
webProcess.stderr.on('data', (d) => process.stderr.write(`[web:err] ${d}`));

function cleanup() {
  console.log('\n[dev:full] Encerrando processos...');
  try { apiProcess.kill('SIGTERM'); } catch {}
  try { webProcess.kill('SIGTERM'); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

apiProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[api] Processo da API encerrou com código ${code}`);
    cleanup();
  }
});

webProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[web] Processo do frontend encerrou com código ${code}`);
    cleanup();
  }
});
