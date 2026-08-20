#!/usr/bin/env node
/**
 * import-cpm1969.mjs
 *
 * Importador do Código Penal Militar (Decreto-Lei 1.001/1969) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs` (mesma família do CP/1940 e CPP/1941).
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cpm1969', {
  title: 'Código Penal Militar',
  urn: 'urn:lex:br:federal:decreto.lei:1969-10-21;1001',
  type: 'decreto-lei',
  year: 1969,
  number: '1001',
  popularName: 'CPM',
  aliases: ['CPM', 'cpm', 'Decreto-Lei 1001', 'DL 1001', 'Código Penal Militar'],
  ementa: 'Código Penal Militar.',
  publicationDate: '1969-10-21',
  versionDate: '1969-10-21',
  sourceFile: 'legal/sources/cpm1969/del1001.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
