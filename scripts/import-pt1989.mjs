#!/usr/bin/env node
/**
 * import-pt1989.mjs
 *
 * Importador da Lei 7.960/1989 (Prisão Temporária) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('pt1989', {
  title: 'Lei da Prisão Temporária',
  urn: 'urn:lex:br:federal:lei:1989-12-21;7960',
  type: 'lei',
  year: 1989,
  number: '7960',
  popularName: 'PT',
  aliases: ['PT', 'pt', 'Prisão Temporária', 'Lei 7960', 'Lei 7.960'],
  ementa: 'Dispõe sobre a prisão temporária de suspeitos e acusados de prática de crimes hediondos ou equiparados.',
  publicationDate: '1989-12-22',
  versionDate: '1989-12-21',
  sourceFile: 'legal/sources/pt1989/l7960.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7960.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
