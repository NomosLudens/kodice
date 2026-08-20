#!/usr/bin/env node
/**
 * import-tortura1997.mjs
 *
 * Importador da Lei 9.455/1997 (Tortura) a partir do snapshot oficial
 * do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('tortura1997', {
  title: 'Lei de Tortura',
  urn: 'urn:lex:br:federal:lei:1997-04-07;9455',
  type: 'lei',
  year: 1997,
  number: '9455',
  popularName: 'TORTURA',
  aliases: ['TORTURA', 'tortura', 'Lei de Tortura', 'Lei 9455', 'Lei 9.455'],
  ementa: 'Define os crimes de tortura e dá outras providências.',
  publicationDate: '1997-04-08',
  versionDate: '1997-04-07',
  sourceFile: 'legal/sources/tortura1997/l9455.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9455.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
