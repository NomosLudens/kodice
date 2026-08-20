#!/usr/bin/env node
/**
 * import-idcriminal2009.mjs
 *
 * Importador da Lei 12.037/2009 (Identificação Criminal) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('idcriminal2009', {
  title: 'Lei da Identificação Criminal',
  urn: 'urn:lex:br:federal:lei:2009-08-11;12037',
  type: 'lei',
  year: 2009,
  number: '12037',
  popularName: 'IDCRIMINAL',
  aliases: ['IDCRIMINAL', 'idcriminal', 'Identificação Criminal', 'Lei 12037', 'Lei 12.037'],
  ementa: 'Dispõe sobre a identificação criminal do civilmente identificado, regulamentando o art. 5º, inciso LVIII, da Constituição Federal.',
  publicationDate: '2009-08-12',
  versionDate: '2009-08-11',
  sourceFile: 'legal/sources/idcriminal2009/l12037.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12037.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
