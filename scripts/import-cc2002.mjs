#!/usr/bin/env node
/**
 * import-cc2002.mjs
 *
 * Importador do Código Civil (Lei 10.406/2002) a partir do snapshot oficial
 * do Planalto (HTTPS, ISO-8859-1). Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cc2002', {
  title: 'Código Civil',
  urn: 'urn:lex:br:federal:lei:2002-01-10;10406',
  type: 'lei',
  year: 2002,
  number: '10406',
  popularName: 'Código Civil',
  aliases: [
    'CC', 'CC2002', 'CC/2002', 'Codigo Civil', 'Código Civil',
    'Lei 10406', 'Lei 10.406', 'lei-10406', 'lei-10-406',
  ],
  ementa: 'Institui o Código Civil.',
  publicationDate: '2002-01-11',
  versionDate: '2002-01-10',
  sourceFile: 'legal/sources/cc2002/l10406.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
