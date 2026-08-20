#!/usr/bin/env node
/**
 * import-intercept1996.mjs
 *
 * Importador da Lei 9.296/1996 (Interceptação Telefônica) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('intercept1996', {
  title: 'Lei da Interceptação Telefônica',
  urn: 'urn:lex:br:federal:lei:1996-07-24;9296',
  type: 'lei',
  year: 1996,
  number: '9296',
  popularName: 'INTERCEPT',
  aliases: ['INTERCEPT', 'intercept', 'Interceptação Telefônica', 'Lei 9296', 'Lei 9.296'],
  ementa: 'Regula a interceptação das comunicações telefônicas, de qualquer natureza, para fins de investigação criminal ou instrução processual penal.',
  publicationDate: '1996-07-25',
  versionDate: '1996-07-24',
  sourceFile: 'legal/sources/intercept1996/l9296.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9296.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
