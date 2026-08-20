#!/usr/bin/env node
/**
 * import-seguro-desemp1990.mjs
 *
 * Importador da Lei 7.998/1990 (Lei do Seguro-Desemprego) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('seguro-desemp1990', {
  title: 'Lei do Seguro-Desemprego',
  urn: 'urn:lex:br:federal:lei:1990-08-14;7998',
  type: 'lei',
  year: 1990, number: '7998',
  popularName: 'SEGURO_DESEMP',
  aliases: ['SEGURO_DESEMP', 'seguro_desemp', 'Seguro-Desemprego', 'Lei 7998', 'Lei 7.998', 'Seguro Desemprego'],
  ementa: 'Institui o Fundo de Amparo ao Trabalhador - FAT, e dá outras providências.',
  publicationDate: '1990-08-15', versionDate: '1990-08-14',
  sourceFile: 'legal/sources/seguro-desemp1990/l7998compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7998compilado.htm',
});
