#!/usr/bin/env node
/**
 * import-fgts1990.mjs
 *
 * Importador da Lei 8.036/1990 (FGTS) a partir do snapshot oficial
 * da Câmara dos Deputados (texto consolidado). O Planalto não serve
 * a URL (404 em todas as variações). A Câmara hospeda como HTML
 * texto-atualizado. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs` (que agora detecta encoding UTF-8
 * automaticamente — Câmara publica em UTF-8, Planalto em latin1).
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('fgts1990', {
  title: 'Lei do FGTS',
  urn: 'urn:lex:br:federal:lei:1990-05-11;8036',
  type: 'lei',
  year: 1990, number: '8036',
  popularName: 'FGTS',
  aliases: ['FGTS', 'fgts', 'Fundo de Garantia', 'Lei 8036', 'Lei 8.036', 'Lei 8.036/1990', 'Fundo de Garantia do Tempo de Serviço'],
  ementa: 'Dispõe sobre o Fundo de Garantia do Tempo de Serviço e dá outras providências.',
  publicationDate: '1990-05-12', versionDate: '1990-05-11',
  sourceFile: 'legal/sources/fgts1990/lei-8036-11-maio-1990-365155-normaatualizada-pl.html',
  sourceUrl: 'https://www2.camara.leg.br/legin/fed/lei/1990/lei-8036-11-maio-1990-365155-normaatualizada-pl.html',
});
