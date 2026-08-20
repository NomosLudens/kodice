#!/usr/bin/env node
/**
 * import-lai2011.mjs
 *
 * Importador da Lei de Acesso à Informação (Lei 12.527/2011) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lai2011', {
  title: 'Lei de Acesso à Informação',
  urn: 'urn:lex:br:federal:lei:2011-11-18;12527',
  type: 'lei',
  year: 2011,
  number: '12527',
  popularName: 'LAI',
  aliases: ['LAI', 'lai', 'Lei 12527', 'Lei 12.527', 'Acesso à Informação'],
  ementa: 'Regula o acesso a informações públicas.',
  publicationDate: '2011-11-18',
  versionDate: '2011-11-18',
  sourceFile: 'legal/sources/lai2011/l12527.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
