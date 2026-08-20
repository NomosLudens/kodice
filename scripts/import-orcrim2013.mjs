#!/usr/bin/env node
/**
 * import-orcrim2013.mjs
 *
 * Importador da Lei 12.850/2013 (Organizações Criminosas) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('orcrim2013', {
  title: 'Lei das Organizações Criminosas',
  urn: 'urn:lex:br:federal:lei:2013-08-02;12850',
  type: 'lei',
  year: 2013,
  number: '12850',
  popularName: 'ORCRIM',
  aliases: ['ORCRIM', 'orcrim', 'Organização Criminosa', 'Organizações Criminosas', 'Lei 12850', 'Lei 12.850'],
  ementa: 'Define organização criminosa e dispõe sobre a investigação criminal, os meios de obtenção da prova, infrações penais correlatas e o procedimento criminal a ser aplicado.',
  publicationDate: '2013-08-05',
  versionDate: '2013-08-02',
  sourceFile: 'legal/sources/orcrim2013/l12850.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
