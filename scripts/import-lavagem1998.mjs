#!/usr/bin/env node
/**
 * import-lavagem1998.mjs
 *
 * Importador da Lei 9.613/1998 (Lavagem de Dinheiro) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lavagem1998', {
  title: 'Lei de Lavagem de Dinheiro',
  urn: 'urn:lex:br:federal:lei:1998-03-03;9613',
  type: 'lei',
  year: 1998,
  number: '9613',
  popularName: 'LAVAGEM',
  aliases: ['LAVAGEM', 'lavagem', 'Lavagem de Dinheiro', 'Lei 9613', 'Lei 9.613'],
  ementa: 'Dispõe sobre os crimes de "lavagem" ou ocultação de bens, direitos e valores; a prevenção da utilização do sistema financeiro para os ilícitos previstos nesta Lei; cria o Conselho de Controle de Atividades Financeiras - COAF, e dá outras providências.',
  publicationDate: '1998-03-04',
  versionDate: '1998-03-03',
  sourceFile: 'legal/sources/lavagem1998/l9613.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9613.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
