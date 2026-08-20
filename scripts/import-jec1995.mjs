#!/usr/bin/env node
/**
 * import-jec1995.mjs
 *
 * Importador da Lei 9.099/1995 (Juizados Especiais Cíveis e Criminais)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('jec1995', {
  title: 'Lei dos Juizados Especiais Cíveis e Criminais',
  urn: 'urn:lex:br:federal:lei:1995-09-26;9099',
  type: 'lei',
  year: 1995,
  number: '9099',
  popularName: 'JEC',
  aliases: ['JEC', 'jec', 'Juizados Especiais Cíveis e Criminais', 'Juizados Especiais', 'Lei 9099', 'Lei 9.099', 'Lei dos Juizados Especiais'],
  ementa: 'Dispõe sobre os Juizados Especiais Cíveis e Criminais e dá outras providências.',
  publicationDate: '1995-09-27',
  versionDate: '1995-09-26',
  sourceFile: 'legal/sources/jec1995/l9099.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9099.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
