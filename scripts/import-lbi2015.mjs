#!/usr/bin/env node
/**
 * import-lbi2015.mjs
 *
 * Importador da Lei Brasileira de Inclusão da Pessoa com Deficiência
 * (Lei 13.146/2015) a partir do snapshot oficial do Planalto.
 * Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lbi2015', {
  title: 'Lei Brasileira de Inclusão da Pessoa com Deficiência',
  urn: 'urn:lex:br:federal:lei:2015-07-06;13146',
  type: 'lei',
  year: 2015,
  number: '13146',
  popularName: 'LBI',
  aliases: ['LBI', 'lbi', 'Lei 13146', 'Lei 13.146', 'Estatuto da Pessoa com Deficiência'],
  ementa: 'Institui a Lei Brasileira de Inclusão da Pessoa com Deficiência.',
  publicationDate: '2015-07-07',
  versionDate: '2015-07-06',
  sourceFile: 'legal/sources/lbi2015/l13146.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
