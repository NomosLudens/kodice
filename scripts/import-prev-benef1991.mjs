#!/usr/bin/env node
/**
 * import-prev-benef1991.mjs
 *
 * Importador da Lei 8.213/1991 (Lei de Benefícios da Previdência Social)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser
 * genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('prev-benef1991', {
  title: 'Lei de Benefícios da Previdência Social',
  urn: 'urn:lex:br:federal:lei:1991-07-24;8213',
  type: 'lei',
  year: 1991, number: '8213',
  popularName: 'PREV_BENEF',
  aliases: ['PREV_BENEF', 'prev_benef', 'Lei 8213', 'Lei 8.213', 'Benefícios da Previdência', 'Previdência Social', 'Aposentadoria', 'Pensão por Morte', 'Auxílio-Doença'],
  ementa: 'Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências.',
  publicationDate: '1991-07-25', versionDate: '1991-07-24',
  sourceFile: 'legal/sources/prev-benef1991/l8213compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8213compilado.htm',
});
