#!/usr/bin/env node
/**
 * import-mi2016.mjs
 *
 * Importador da Lei 13.300/2016 (Mandado de Injunção) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('mi2016', {
  title: 'Lei do Mandado de Injunção',
  urn: 'urn:lex:br:federal:lei:2016-06-23;13300',
  type: 'lei',
  year: 2016,
  number: '13300',
  popularName: 'MI',
  aliases: ['MI', 'mi', 'Mandado de Injunção', 'Lei 13300', 'Lei 13.300'],
  ementa: 'Disciplina o processo e o julgamento dos mandados de injunção e das ações declaratórias de constitucionalidade, e dá outras providências.',
  publicationDate: '2016-06-24',
  versionDate: '2016-06-23',
  sourceFile: 'legal/sources/mi2016/l13300.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13300.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
