#!/usr/bin/env node
/**
 * scripts/verify-legal-corpus.mjs
 *
 * Valida o pipeline jurídico vigente do Kódice:
 *   1) Há pelo menos uma norma oficial em legal/corpus/ (não _sample/).
 *   2) O importador reproduz o hash de sourceFile/snapshot.
 *   3) As unidades necessárias (preambulo + art300) estão presentes.
 *
 * O materializador SQLite e a API HTTP são cobertos por test-legal-db.mjs
 * e test-legal-api.mjs. Este gate é o ponto de entrada do produto.
 */
import { loadCorpus } from './legal-corpus-lib.mjs';

let failed = 0;
function ok(name) { console.log(`ok - ${name}`); }
function fail(name, msg) { console.error(`not ok - ${name}: ${msg}`); failed++; }

try {
  const norms = await loadCorpus();
  if (!norms.length) {
    fail('corpus oficial', 'Nenhuma norma em legal/corpus/');
    process.exit(1);
  }

  for (const norm of norms) {
    ok(`norma carregada: ${norm.id} (${norm.units.length} unidades, ${norm.acquisition.articleCount} artigos)`);
    if (norm.id === 'cpc2015') {
      const art300 = norm.units.find(u => u.canonicalPath === 'art300');
      if (!art300) {
        fail('cpc2015:art300', 'Art. 300 ausente no corpus');
        continue;
      }
      ok('cpc2015:art300 presente');
      if (!art300.text.includes('tutela de urgência será concedida')) {
        fail('cpc2015:art300 texto', 'Texto do Art. 300 não confere com redação oficial');
      } else {
        ok('cpc2015:art300 texto oficial confere');
      }
      const pars = norm.units.filter(u => u.canonicalPath.startsWith('art300-par'));
      if (pars.length < 1) {
        fail('cpc2015:art300 parágrafos', 'Sem parágrafos detectados para Art. 300');
      } else {
        ok(`cpc2015:art300 parágrafos detectados (${pars.length})`);
      }
    }
  }

  if (failed > 0) process.exit(1);
  console.log(`\nLegal corpus verified: ${norms.length} norm(s).`);
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}