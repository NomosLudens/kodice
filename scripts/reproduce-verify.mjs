#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLegalDatabase } from './build-legal-db.mjs';
import { computeDbLogicalHash } from './compute-db-logical-hash.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const EXPECTED_NORMS = 61;
const EXPECTED_UNITS = 36045;
const EXPECTED_LOGICAL_HASH = '7e09b098072983fb87854e5e2fcceed809bde308069e37b454b07e4d15aa512f';

console.log('=== KÓDICE — VERIFICAÇÃO DE REPRODUTIBILIDADE ===\n');

function runStep(name, fn) {
  process.stdout.write(`[1/5] ${name}... `);
  try {
    fn();
    console.log('OK');
  } catch (err) {
    console.log('FALHOU');
    console.error(`\nErro em "${name}":`, err.message || err);
    process.exit(1);
  }
}

function runCommand(desc, cmd, args) {
  process.stdout.write(`${desc}... `);
  const res = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    console.error(`\nFalha ao executar ${cmd} ${args.join(' ')} (exit code ${res.status})`);
    process.exit(res.status || 1);
  }
  console.log('OK');
}

const targetDb = path.resolve(rootDir, 'legal.db');

// 1. Limpeza do banco local para reconstrução pura
process.stdout.write('[1/5] Reconstruindo legal.db a partir de legal/corpus/... ');
for (const f of [targetDb, `${targetDb}-wal`, `${targetDb}-shm`]) {
  if (existsSync(f)) rmSync(f);
}

const buildRes = await buildLegalDatabase(targetDb);
if (!buildRes || !buildRes.results) {
  console.log('FALHOU');
  console.error('Falha ao materializar banco SQLite');
  process.exit(1);
}
console.log('OK');

// 2. Verificação de integridade e hash lógico canônico
process.stdout.write('[2/5] Validando integridade relacional e hash lógico canônico... ');
const hashResult = computeDbLogicalHash(targetDb);

if (hashResult.normsCount !== EXPECTED_NORMS) {
  console.log('FALHOU');
  console.error(`Esperado ${EXPECTED_NORMS} normas, obtido ${hashResult.normsCount}`);
  process.exit(1);
}
if (hashResult.unitsCount !== EXPECTED_UNITS) {
  console.log('FALHOU');
  console.error(`Esperado ${EXPECTED_UNITS} unidades, obtido ${hashResult.unitsCount}`);
  process.exit(1);
}
if (hashResult.logicalHash !== EXPECTED_LOGICAL_HASH) {
  console.log('FALHOU');
  console.error(`Hash lógico divergente!\n  Esperado: ${EXPECTED_LOGICAL_HASH}\n  Obtido:   ${hashResult.logicalHash}`);
  process.exit(1);
}
console.log(`OK (hash: ${hashResult.logicalHash.slice(0, 16)}...)`);

// 3. Verificações de limites de produto e isolamento
console.log('[3/5] Executando testes de fronteiras e desacoplamento:');
runCommand('  - Verificação de fronteiras e URLs privadas', 'node', ['scripts/verify-product-boundaries.mjs']);
runCommand('  - Testes de autenticação e política de Estação', 'node', ['scripts/test-station-auth.mjs']);

// 4. Testes de banco e API jurídica
console.log('[4/5] Executando testes da camada jurídica:');
runCommand('  - Teste de banco SQLite local', 'node', ['scripts/test-legal-db.mjs']);
runCommand('  - Teste da API jurídica', 'node', ['scripts/test-legal-api.mjs']);

// 5. Build de produção do frontend
console.log('[5/5] Testando build do frontend com Vite:');
const bunOrNpx = process.env.USE_BUN === '1' ? 'bun' : 'npx';
runCommand('  - Build da aplicação web', 'npx', ['vite', 'build']);

console.log('\n============================================================');
console.log('PROVA DE REPRODUTIBILIDADE CONCLUÍDA COM SUCESSO!');
console.log(`NORMS:        ${hashResult.normsCount}`);
console.log(`UNITS:        ${hashResult.unitsCount}`);
console.log(`LOGICAL_HASH: ${hashResult.logicalHash}`);
console.log('============================================================\n');
