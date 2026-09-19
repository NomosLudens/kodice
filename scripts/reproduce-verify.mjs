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

console.log('=== KÓDICE — PROVA INTEGRAL DE REPRODUTIBILIDADE ===\n');

function runCommand(stepNumber, totalSteps, desc, cmd, args) {
  process.stdout.write(`[${stepNumber}/${totalSteps}] ${desc}... `);
  const res = spawnSync(cmd, args, { cwd: rootDir, stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    console.error(`\nFALHA na etapa "${desc}" (${cmd} ${args.join(' ')} encerrou com código ${res.status})`);
    process.exit(res.status || 1);
  }
  console.log('OK');
}

const targetDb = path.resolve(rootDir, 'legal.db');

// Etapa 1: Limpeza do banco SQLite gerado
process.stdout.write('[1/10] Removendo legal.db gerado... ');
for (const f of [targetDb, `${targetDb}-wal`, `${targetDb}-shm`]) {
  if (existsSync(f)) rmSync(f);
}
console.log('OK');

// Etapa 2: Reconstrução determinística do banco SQLite
process.stdout.write('[2/10] Reconstruindo legal.db a partir de legal/corpus/... ');
const buildRes = await buildLegalDatabase(targetDb);
if (!buildRes || !buildRes.results) {
  console.error('\nFALHA ao materializar banco SQLite');
  process.exit(1);
}
console.log('OK');

// Etapa 3: Validação de integridade relacional, contagens e hash canônico
process.stdout.write('[3/10] Validando integridade relacional e hash lógico canônico... ');
const hashResult = computeDbLogicalHash(targetDb);
if (hashResult.normsCount !== EXPECTED_NORMS) {
  console.error(`\nFALHA: esperado ${EXPECTED_NORMS} normas, obtido ${hashResult.normsCount}`);
  process.exit(1);
}
if (hashResult.unitsCount !== EXPECTED_UNITS) {
  console.error(`\nFALHA: esperado ${EXPECTED_UNITS} unidades, obtido ${hashResult.unitsCount}`);
  process.exit(1);
}
if (hashResult.logicalHash !== EXPECTED_LOGICAL_HASH) {
  console.error(`\nFALHA: hash lógico divergente!\n  Esperado: ${EXPECTED_LOGICAL_HASH}\n  Obtido:   ${hashResult.logicalHash}`);
  process.exit(1);
}
console.log(`OK (hash: ${hashResult.logicalHash.slice(0, 16)}...)`);

// Etapa 4: Testes da camada jurídica
runCommand(4, 10, 'Testes unitários do banco SQLite', 'node', ['scripts/test-legal-db.mjs']);
runCommand(4, 10, 'Testes de contrato da API jurídica', 'node', ['scripts/test-legal-api.mjs']);

// Etapa 5: Verificação semântica do corpus oficial
runCommand(5, 10, 'Verificação semântica do corpus legal (61 normas)', 'node', ['scripts/verify-legal-corpus.mjs']);

// Etapa 6: Verificação de fronteiras, isolamento e autenticação de Estação
runCommand(6, 10, 'Verificação de fronteiras de produto e segredos', 'node', ['scripts/verify-product-boundaries.mjs']);
runCommand(6, 10, 'Verificação de desacoplamento arquitetural', 'node', ['scripts/verify-decoupling.mjs']);
runCommand(6, 10, 'Testes de autenticação e isolamento da Estação', 'node', ['scripts/test-station-auth.mjs']);

// Etapa 7: Build do frontend com Vite (usando runtime local sem npx)
const viteBin = path.resolve(rootDir, 'node_modules/vite/bin/vite.js');
runCommand(7, 10, 'Build dos assets do frontend (Vite)', 'node', [viteBin, 'build']);

// Etapa 8: Construção e injeção de precache do Service Worker
runCommand(8, 10, 'Geração do Service Worker para modo offline PWA', 'node', ['scripts/build-service-worker.mjs']);

// Etapa 9: Bateria de testes de interface, motores de leitura e regressões
runCommand(9, 10, 'Testes do motor PDF.js em Web Worker', 'node', ['scripts/test-pdf-engine.mjs']);
runCommand(9, 10, 'Testes de regressão P1', 'node', ['scripts/test-p1-regressions.mjs']);
runCommand(9, 10, 'Testes de runtime P1', 'node', ['scripts/test-p1-runtime.mjs']);
runCommand(9, 10, 'Testes do leitor com arquivos reais', 'node', ['scripts/test-reader-real.mjs']);
runCommand(9, 10, 'Testes de backup local e assinaturas', 'node', ['scripts/test-backup-real.mjs']);
runCommand(9, 10, 'Testes de superfície do Vade Mecum (Puppeteer)', 'node', ['scripts/test-vade-mecum-surface.mjs']);

// Etapa 10: Verificação final de integridade do PWA e assets estáticos
runCommand(10, 10, 'Verificação de integridade dos assets PWA e precache', 'node', ['scripts/verify-pwa.mjs']);

console.log('\n============================================================');
console.log('PROVA INTEGRAL DE REPRODUTIBILIDADE: PASS');
console.log(`NORMS:        ${hashResult.normsCount}`);
console.log(`UNITS:        ${hashResult.unitsCount}`);
console.log(`LOGICAL_HASH: ${hashResult.logicalHash}`);
console.log('TODAS AS 10 ETAPAS FORAM CONCLUÍDAS COM SUCESSO.');
console.log('============================================================\n');
