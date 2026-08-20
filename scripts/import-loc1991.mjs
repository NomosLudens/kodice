#!/usr/bin/env node
/**
 * import-loc1991.mjs
 *
 * Importador da Lei 8.245/1991 (Locações) a partir do snapshot oficial
 * do Planalto. Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('loc1991', {
  title: 'Lei das Locações',
  urn: 'urn:lex:br:federal:lei:1991-10-18;8245',
  type: 'lei',
  year: 1991,
  number: '8245',
  popularName: 'LOC',
  aliases: ['LOC', 'loc', 'Locações', 'Lei 8245', 'Lei 8.245', 'Locação'],
  ementa: 'Dispõe sobre as locações dos imóveis urbanos e os procedimentos a elas pertinentes.',
  publicationDate: '1991-10-21',
  versionDate: '1991-10-18',
  sourceFile: 'legal/sources/loc1991/l8245compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8245compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
