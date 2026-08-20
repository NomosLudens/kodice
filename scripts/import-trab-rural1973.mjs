#!/usr/bin/env node
/**
 * import-trab-rural1973.mjs
 *
 * Importador da Lei 5.889/1973 (Estatuto do Trabalhador Rural) a
 * partir do snapshot oficial do Planalto. Reutiliza o parser
 * genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('trab-rural1973', {
  title: 'Estatuto do Trabalhador Rural',
  urn: 'urn:lex:br:federal:lei:1973-06-08;5889',
  type: 'lei',
  year: 1973, number: '5889',
  popularName: 'TRAB_RURAL',
  aliases: ['TRAB_RURAL', 'trab_rural', 'Trabalhador Rural', 'Estatuto Rural', 'Lei 5889', 'Lei 5.889', 'Trabalho Rural'],
  ementa: 'Estatuto do Trabalhador Rural.',
  publicationDate: '1973-06-11', versionDate: '1973-06-08',
  sourceFile: 'legal/sources/trab-rural1973/l5889.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l5889.htm',
});
