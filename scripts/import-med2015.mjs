#!/usr/bin/env node
/**
 * import-med2015.mjs
 *
 * Importador da Lei 13.140/2015 (Mediação) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('med2015', {
  title: 'Lei da Mediação',
  urn: 'urn:lex:br:federal:lei:2015-06-29;13140',
  type: 'lei',
  year: 2015,
  number: '13140',
  popularName: 'MED',
  aliases: ['MED', 'med', 'Mediação', 'Lei 13140', 'Lei 13.140'],
  ementa: 'Dispõe sobre a mediação entre particulares como meio de solução de controvérsias e sobre a autocomposição de conflitos no âmbito da administração pública.',
  publicationDate: '2015-06-30',
  versionDate: '2015-06-29',
  sourceFile: 'legal/sources/med2015/l13140.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13140.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
