#!/usr/bin/env node
/**
 * import-cppm1969.mjs
 *
 * Importador do Código de Processo Penal Militar (Decreto-Lei 1.002/1969)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs` (mesma família do CPP/1941 e CP/1940).
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cppm1969', {
  title: 'Código de Processo Penal Militar',
  urn: 'urn:lex:br:federal:decreto.lei:1969-10-21;1002',
  type: 'decreto-lei',
  year: 1969,
  number: '1002',
  popularName: 'CPPM',
  aliases: ['CPPM', 'cppm', 'Decreto-Lei 1002', 'DL 1002', 'Código de Processo Penal Militar'],
  ementa: 'Código de Processo Penal Militar.',
  publicationDate: '1969-10-21',
  versionDate: '1969-10-21',
  sourceFile: 'legal/sources/cppm1969/del1002.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
