#!/usr/bin/env node
/**
 * import-adpf1999.mjs
 *
 * Importador da Lei 9.882/1999 (ADPF) a partir do snapshot oficial do
 * Planalto. Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('adpf1999', {
  title: 'Lei da ADPF',
  urn: 'urn:lex:br:federal:lei:1999-12-03;9882',
  type: 'lei',
  year: 1999,
  number: '9882',
  popularName: 'ADPF',
  aliases: ['ADPF', 'adpf', 'Lei 9882', 'Lei 9.882', 'Lei da ADPF', 'Arguição de Descumprimento'],
  ementa: 'Dispõe sobre o processo e julgamento da arguição de descumprimento de preceito fundamental, nos termos do § 1º do art. 102 da Constituição Federal.',
  publicationDate: '1999-12-06',
  versionDate: '1999-12-03',
  sourceFile: 'legal/sources/adpf1999/l9882.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9882.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
