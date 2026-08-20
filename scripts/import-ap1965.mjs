#!/usr/bin/env node
/**
 * import-ap1965.mjs
 *
 * Importador da Lei 4.717/1965 (Ação Popular) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('ap1965', {
  title: 'Lei da Ação Popular',
  urn: 'urn:lex:br:federal:lei:1965-07-23;4717',
  type: 'lei',
  year: 1965,
  number: '4717',
  popularName: 'AP',
  aliases: ['AP', 'ap', 'Ação Popular', 'Lei 4717', 'Lei 4.717'],
  ementa: 'Regula a ação popular.',
  publicationDate: '1965-07-26',
  versionDate: '1965-07-23',
  sourceFile: 'legal/sources/ap1965/l4717.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l4717.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
