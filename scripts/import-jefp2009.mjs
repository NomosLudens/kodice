#!/usr/bin/env node
/**
 * import-jefp2009.mjs
 *
 * Importador da Lei 12.153/2009 (Juizados Especiais da Fazenda Pública)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('jefp2009', {
  title: 'Lei dos Juizados Especiais da Fazenda Pública',
  urn: 'urn:lex:br:federal:lei:2009-08-12;12153',
  type: 'lei',
  year: 2009,
  number: '12153',
  popularName: 'JEFP',
  aliases: ['JEFP', 'jefp', 'Juizado da Fazenda Pública', 'Juizados da Fazenda Pública', 'Juizado Fazenda Pública', 'Lei 12153', 'Lei 12.153'],
  ementa: 'Dispõe sobre os Juizados Especiais da Fazenda Pública no âmbito dos Estados, do Distrito Federal, dos Municípios e da União.',
  publicationDate: '2009-08-13',
  versionDate: '2009-08-12',
  sourceFile: 'legal/sources/jefp2009/l12153.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
