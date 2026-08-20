#!/usr/bin/env node
/**
 * import-jef2001.mjs
 *
 * Importador da Lei 10.259/2001 (Juizados Especiais Federais) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('jef2001', {
  title: 'Lei dos Juizados Especiais Federais',
  urn: 'urn:lex:br:federal:lei:2001-07-10;10259',
  type: 'lei',
  year: 2001,
  number: '10259',
  popularName: 'JEF',
  aliases: ['JEF', 'jef', 'Juizados Especiais Federais', 'Juizados Federais', 'Lei 10259', 'Lei 10.259'],
  ementa: 'Dispõe sobre a instituição dos Juizados Especiais Cíveis e Criminais no âmbito da Justiça Federal.',
  publicationDate: '2001-07-11',
  versionDate: '2001-07-10',
  sourceFile: 'legal/sources/jef2001/l10259.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10259.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
