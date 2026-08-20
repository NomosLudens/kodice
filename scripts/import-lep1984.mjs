#!/usr/bin/env node
/**
 * import-lep1984.mjs
 *
 * Importador da Lei de Execução Penal (Lei 7.210/1984) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lep1984', {
  title: 'Lei de Execução Penal',
  urn: 'urn:lex:br:federal:lei:1984-07-11;7210',
  type: 'lei',
  year: 1984,
  number: '7210',
  popularName: 'LEP',
  aliases: ['LEP', 'lep', 'Lei 7210', 'Lei 7.210', 'Lei de Execução Penal'],
  ementa: 'Institui a Lei de Execução Penal.',
  publicationDate: '1984-07-13',
  versionDate: '1984-07-11',
  sourceFile: 'legal/sources/lep1984/l7210compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7210compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
