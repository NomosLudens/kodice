#!/usr/bin/env node
/**
 * import-anticorrup2013.mjs
 *
 * Importador da Lei 12.846/2013 (Lei Anticorrupção) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('anticorrup2013', {
  title: 'Lei Anticorrupção',
  urn: 'urn:lex:br:federal:lei:2013-08-01;12846',
  type: 'lei',
  year: 2013,
  number: '12846',
  popularName: 'ANTICORRUP',
  aliases: ['ANTICORRUP', 'anticorrup', 'anticorrupcao', 'Anticorrupção', 'Lei 12846', 'Lei 12.846', 'Lei Anticorrupção', 'Ato Lesivo'],
  ementa: 'Dispõe sobre a responsabilização administrativa e civil de pessoas jurídicas pela prática de atos contra a administração pública, nacional ou estrangeira, e dá outras providências.',
  publicationDate: '2013-08-02',
  versionDate: '2013-08-01',
  sourceFile: 'legal/sources/anticorrup2013/l12846.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
