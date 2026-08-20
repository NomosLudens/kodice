#!/usr/bin/env node
/**
 * import-lrf2000.mjs
 *
 * Importador da Lei Complementar 101/2000 (Lei de Responsabilidade
 * Fiscal) a partir do snapshot oficial do Planalto. Reutiliza o parser
 * genérico `import-planalto-codigo.mjs`.
 *
 * O schema atual aceita `type: 'lei.complementar'` (campo livre, não
 * enum) e o parser Planalto genérico trata a estrutura sem modificações.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lrf2000', {
  title: 'Lei de Responsabilidade Fiscal',
  urn: 'urn:lex:br:federal:lei.complementar:2000-05-04;101',
  type: 'lei.complementar',
  year: 2000,
  number: '101',
  popularName: 'LRF',
  aliases: ['LRF', 'lrf', 'Lei de Responsabilidade Fiscal', 'LC 101', 'LC 101/2000', 'Lei Complementar 101', 'Responsabilidade Fiscal'],
  ementa: 'Estabelece normas de finanças públicas voltadas para a responsabilidade na gestão fiscal e dá outras providências.',
  publicationDate: '2000-05-05',
  versionDate: '2000-05-04',
  sourceFile: 'legal/sources/lrf2000/lcp101.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
