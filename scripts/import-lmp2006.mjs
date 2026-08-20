#!/usr/bin/env node
/**
 * import-lmp2006.mjs
 *
 * Importador da Lei Maria da Penha (Lei 11.340/2006) a partir do
 * snapshot oficial do Planalto. O snapshot é UTF-16-LE (detectado
 * automaticamente pelo `import-planalto-codigo.mjs`).
 * Reutiliza o parser genérico.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lmp2006', {
  title: 'Lei Maria da Penha',
  urn: 'urn:lex:br:federal:lei:2006-08-07;11340',
  type: 'lei',
  year: 2006,
  number: '11340',
  popularName: 'LMP',
  aliases: ['LMP', 'lmp', 'Maria da Penha', 'Lei 11340', 'Lei 11.340', 'Lei Maria da Penha'],
  ementa: 'Cria mecanismos para coibir a violência doméstica e familiar contra a mulher.',
  publicationDate: '2006-08-08',
  versionDate: '2006-08-07',
  sourceFile: 'legal/sources/lmp2006/l11340.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
