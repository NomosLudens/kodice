#!/usr/bin/env node
/**
 * import-nllc2021.mjs
 *
 * Importador da Lei 14.133/2021 (Nova Lei de Licitações e Contratos
 * Administrativos) a partir do snapshot oficial do Planalto. Reutiliza
 * o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('nllc2021', {
  title: 'Nova Lei de Licitações e Contratos Administrativos',
  urn: 'urn:lex:br:federal:lei:2021-04-01;14133',
  type: 'lei',
  year: 2021,
  number: '14133',
  popularName: 'NLLC',
  aliases: ['NLLC', 'nllc', 'Nova Lei de Licitações', 'Licitações', 'Lei 14133', 'Lei 14.133'],
  ementa: 'Lei de Licitações e Contratos Administrativos.',
  publicationDate: '2021-04-01',
  versionDate: '2021-04-01',
  sourceFile: 'legal/sources/nllc2021/l14133.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
