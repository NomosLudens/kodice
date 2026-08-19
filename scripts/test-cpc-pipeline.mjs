#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCpc2015 } from './import-cpc2015.mjs';
import { loadCorpus, validateNorm } from './legal-corpus-lib.mjs';

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

// 1. Prova de determinismo do importador
await test('importador do CPC/2015 é 100% determinístico entre execuções', async () => {
  const norm1 = await parseCpc2015();
  const norm2 = await parseCpc2015();
  const hash1 = createHash('sha256').update(JSON.stringify(norm1)).digest('hex');
  const hash2 = createHash('sha256').update(JSON.stringify(norm2)).digest('hex');
  assert(hash1 === hash2, `Execuções produziram hashes distintos: ${hash1} !== ${hash2}`);
});

// 2. Prova de integridade do arquivo oficial e hash SHA-256
await test('arquivo oficial existe em legal/sources e coincide com sourceHash', async () => {
  const norm = await parseCpc2015();
  const rawBytes = await fs.readFile(norm.sourceFile);
  const actualHash = createHash('sha256').update(rawBytes).digest('hex');
  assert(actualHash === norm.sourceHash, `Hash divergente do arquivo de origem: ${actualHash} vs ${norm.sourceHash}`);
  assert(actualHash === 'ef5749a3c624c8b8644949f6aa61370663b7da1bcfa6e1f1b25cbde5aa70b3e3', 'Hash difere da baseline oficial');
});

// 3. Prova de validação estrutural completa do CPC
await test('corpus gerado do CPC cumpre estritamente schema legal_norms e legal_units', async () => {
  const norms = await loadCorpus();
  const cpc = norms.find(n => n.id === 'cpc2015');
  assert(cpc, 'CPC/2015 ausente do loadCorpus()');
  validateNorm(cpc);
  assert(cpc.acquisition.unitCount === cpc.units.length, 'unitCount divergente');
  assert(cpc.acquisition.articleCount === cpc.units.filter(u => u.kind === 'artigo').length, 'articleCount divergente');
  assert(cpc.acquisition.articleCount === 1075, `Esperado 1075 artigos no CPC, obtido ${cpc.acquisition.articleCount}`);
  assert(cpc.acquisition.unitCount === 4199, `Esperado 4199 unidades no CPC, obtido ${cpc.acquisition.unitCount}`);
});

// 4. Prova vertical do Art. 300
await test('consulta técnica ao Art. 300 e seus parágrafos filhos', async () => {
  const norms = await loadCorpus();
  const cpc = norms.find(n => n.id === 'cpc2015');
  const art300 = cpc.units.find(u => u.canonicalPath === 'art300');
  assert(art300, 'Art. 300 não encontrado no corpus');
  assert(art300.kind === 'artigo', 'kind do Art. 300 deve ser artigo');
  assert(art300.text.includes('tutela de urgência será concedida'), 'Texto do Art. 300 não confere com a redação oficial');

  const par1 = cpc.units.find(u => u.canonicalPath === 'art300-par1');
  assert(par1, '§ 1º do Art. 300 não encontrado');
  assert(par1.parentId === art300.id, 'Parent do § 1º deve ser o Art. 300');
  assert(par1.text.includes('exigir caução real ou fidejussória'), 'Texto do § 1º não confere');

  const par2 = cpc.units.find(u => u.canonicalPath === 'art300-par2');
  assert(par2 && par2.parentId === art300.id, '§ 2º do Art. 300 não encontrado ou parent incorreto');

  const par3 = cpc.units.find(u => u.canonicalPath === 'art300-par3');
  assert(par3 && par3.parentId === art300.id, '§ 3º do Art. 300 não encontrado ou parent incorreto');
});

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
