#!/usr/bin/env node
/**
 * import-lef1980.mjs
 *
 * Importador da Lei 6.830/1980 (Lei de Execução Fiscal) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lef1980', {
  title: 'Lei de Execução Fiscal',
  urn: 'urn:lex:br:federal:lei:1980-09-22;6830',
  type: 'lei',
  year: 1980,
  number: '6830',
  popularName: 'LEF',
  aliases: ['LEF', 'lef', 'Execução Fiscal', 'Lei 6830', 'Lei 6.830'],
  ementa: 'Dispõe sobre a cobrança judicial da Dívida Ativa da Fazenda Pública, e dá outras providências.',
  publicationDate: '1980-09-23',
  versionDate: '1980-09-22',
  sourceFile: 'legal/sources/lef1980/l6830.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l6830.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
