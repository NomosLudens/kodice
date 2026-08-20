#!/usr/bin/env node
/**
 * import-arb1996.mjs
 *
 * Importador da Lei 9.307/1996 (Arbitragem) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('arb1996', {
  title: 'Lei da Arbitragem',
  urn: 'urn:lex:br:federal:lei:1996-09-23;9307',
  type: 'lei',
  year: 1996,
  number: '9307',
  popularName: 'ARB',
  aliases: ['ARB', 'arb', 'Arbitragem', 'Lei 9307', 'Lei 9.307'],
  ementa: 'Dispõe sobre a arbitragem.',
  publicationDate: '1996-09-24',
  versionDate: '1996-09-23',
  sourceFile: 'legal/sources/arb1996/l9307.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9307.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
