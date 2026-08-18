#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildLegalDatabase } from './build-legal-db.mjs';

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

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodice-legal-db-test-'));
const testDbPath = path.join(tmpDir, 'test-legal.db');

try {
  // 1. Prova de materialização inicial
  await test('CORPUS_TO_SQLITE: materializa corpus legal no SQLite', async () => {
    const { results } = await buildLegalDatabase(testDbPath);
    assert(results.length === 1, 'Esperado 1 norma materializada');
    assert(results[0].normId === 'cpc2015', 'Norma materializada deve ser cpc2015');
    assert(results[0].unitCount === 4199, 'unitCount deve ser 4199');
    assert(results[0].articleCount === 1075, 'articleCount deve ser 1075');
  });

  // 2. Prova de integridade relacional e contagens
  await test('INTEGRIDADE_SQLITE: valida contagens e unicidade no banco', async () => {
    const db = new DatabaseSync(testDbPath);
    const normCount = db.prepare('SELECT count(*) as c FROM legal_norms WHERE id = ?').get('cpc2015').c;
    const currentVersionCount = db.prepare('SELECT count(*) as c FROM legal_versions WHERE norm_id = ? AND is_current = 1').get('cpc2015').c;
    const unitCount = db.prepare('SELECT count(*) as c FROM legal_units WHERE norm_id = ?').get('cpc2015').c;
    const articleCount = db.prepare('SELECT count(*) as c FROM legal_units WHERE norm_id = ? AND kind = ?').get('cpc2015', 'artigo').c;

    assert(normCount === 1, `CPC_NORM_COUNT deve ser 1, obtido ${normCount}`);
    assert(currentVersionCount === 1, `CPC_CURRENT_VERSION_COUNT deve ser 1, obtido ${currentVersionCount}`);
    assert(unitCount === 4199, `CPC_UNIT_COUNT deve ser 4199, obtido ${unitCount}`);
    assert(articleCount === 1075, `CPC_ARTICLE_COUNT deve ser 1075, obtido ${articleCount}`);
    db.close();
  });

  // 3. Prova de consulta do Art. 300 no SQLite
  await test('ARTICLE_300_SQLITE: recupera Art. 300 e filhos no banco', async () => {
    const db = new DatabaseSync(testDbPath);
    const art300 = db.prepare('SELECT * FROM legal_units WHERE norm_id = ? AND canonical_path = ?').get('cpc2015', 'art300');
    assert(art300, 'Art. 300 não encontrado no SQLite');
    assert(art300.kind === 'artigo', 'kind deve ser artigo');
    assert(art300.text.includes('tutela de urgência será concedida'), 'Texto do Art. 300 não confere');

    const par1 = db.prepare('SELECT * FROM legal_units WHERE norm_id = ? AND canonical_path = ?').get('cpc2015', 'art300-par1');
    assert(par1, '§ 1º do Art. 300 não encontrado');
    assert(par1.parent_id === art300.id, 'Parent do § 1º deve ser o Art. 300');
    assert(par1.text.includes('exigir caução real ou fidejussória'), 'Texto do § 1º não confere');
    db.close();
  });

  // 4. Prova de idempotência (segunda execução não duplica registros)
  await test('SQLITE_IDEMPOTENT: segunda materialização preserva integridade sem duplicatas', async () => {
    await buildLegalDatabase(testDbPath);
    const db = new DatabaseSync(testDbPath);

    const normCount = db.prepare('SELECT count(*) as c FROM legal_norms WHERE id = ?').get('cpc2015').c;
    const currentVersionCount = db.prepare('SELECT count(*) as c FROM legal_versions WHERE norm_id = ? AND is_current = 1').get('cpc2015').c;
    const unitCount = db.prepare('SELECT count(*) as c FROM legal_units WHERE norm_id = ?').get('cpc2015').c;
    const duplicatePaths = db.prepare(`
      SELECT canonical_path, count(*) as c 
      FROM legal_units 
      WHERE norm_id = ? 
      GROUP BY version_id, canonical_path 
      HAVING count(*) > 1
    `).all('cpc2015');

    assert(normCount === 1, `normCount após re-sync deve ser 1, obtido ${normCount}`);
    assert(currentVersionCount === 1, `currentVersionCount após re-sync deve ser 1, obtido ${currentVersionCount}`);
    assert(unitCount === 4199, `unitCount após re-sync deve ser 4199, obtido ${unitCount}`);
    assert(duplicatePaths.length === 0, `DUPLICATE_CANONICAL_PATHS deve ser 0, encontrado ${duplicatePaths.length}`);
    db.close();
  });

} finally {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
