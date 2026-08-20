#!/usr/bin/env node
/**
 * import-greve1989.mjs
 *
 * Importador da Lei 7.783/1989 (Lei de Greve) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('greve1989', {
  title: 'Lei de Greve',
  urn: 'urn:lex:br:federal:lei:1989-06-28;7783',
  type: 'lei',
  year: 1989, number: '7783',
  popularName: 'GREVE',
  aliases: ['GREVE', 'greve', 'Lei de Greve', 'Lei 7783', 'Lei 7.783', 'Direito de Greve'],
  ementa: 'Dispõe sobre o exercício do direito de greve, define as atividades essenciais, regula o atendimento das necessidades inadiáveis da comunidade, e dá outras providências.',
  publicationDate: '1989-06-29', versionDate: '1989-06-28',
  sourceFile: 'legal/sources/greve1989/l7783.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7783.htm',
});
