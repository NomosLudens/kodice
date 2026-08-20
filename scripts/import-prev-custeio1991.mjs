#!/usr/bin/env node
/**
 * import-prev-custeio1991.mjs
 *
 * Importador da Lei 8.212/1991 (Lei de Custeio da Previdência Social)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser
 * genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('prev-custeio1991', {
  title: 'Lei de Custeio da Previdência Social',
  urn: 'urn:lex:br:federal:lei:1991-07-24;8212',
  type: 'lei',
  year: 1991, number: '8212',
  popularName: 'PREV_CUSTEIO',
  aliases: ['PREV_CUSTEIO', 'prev_custeio', 'Lei 8212', 'Lei 8.212', 'Custeio da Previdência', 'Custeio Previdenciário', 'Contribuição Previdenciária'],
  ementa: 'Organiza a seguridade social, institui Plano de Custeio, e dá outras providências.',
  publicationDate: '1991-07-25', versionDate: '1991-07-24',
  sourceFile: 'legal/sources/prev-custeio1991/l8212compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8212compilado.htm',
});
