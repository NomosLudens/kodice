#!/usr/bin/env node
/**
 * import-ctb1997.mjs
 *
 * Importador do Código de Trânsito Brasileiro (Lei 9.503/1997) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('ctb1997', {
  title: 'Código de Trânsito Brasileiro',
  urn: 'urn:lex:br:federal:lei:1997-09-23;9503',
  type: 'lei',
  year: 1997,
  number: '9503',
  popularName: 'CTB',
  aliases: ['CTB', 'ctb', 'Lei 9503', 'Lei 9.503', 'Código de Trânsito'],
  ementa: 'Institui o Código de Trânsito Brasileiro.',
  publicationDate: '1997-09-24',
  versionDate: '1997-09-23',
  sourceFile: 'legal/sources/ctb1997/l9503.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9503.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
