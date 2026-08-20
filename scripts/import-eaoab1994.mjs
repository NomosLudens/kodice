#!/usr/bin/env node
/**
 * import-eaoab1994.mjs
 *
 * Importador do Estatuto da Advocacia e da OAB (Lei 8.906/1994) a
 * partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('eaoab1994', {
  title: 'Estatuto da Advocacia e da Ordem dos Advogados do Brasil',
  urn: 'urn:lex:br:federal:lei:1994-07-04;8906',
  type: 'lei',
  year: 1994,
  number: '8906',
  popularName: 'EAOAB',
  aliases: ['EAOAB', 'eaoab', 'EOAB', 'eoab', 'Lei 8906', 'Lei 8.906', 'Estatuto da OAB'],
  ementa: 'Dispõe sobre o Estatuto da Advocacia e a Ordem dos Advogados do Brasil.',
  publicationDate: '1994-07-05',
  versionDate: '1994-07-04',
  sourceFile: 'legal/sources/eaoab1994/l8906.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8906.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
