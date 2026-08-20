#!/usr/bin/env node
/**
 * import-ms2009.mjs
 *
 * Importador da Lei 12.016/2009 (Mandado de Segurança) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('ms2009', {
  title: 'Lei do Mandado de Segurança',
  urn: 'urn:lex:br:federal:lei:2009-08-07;12016',
  type: 'lei',
  year: 2009,
  number: '12016',
  popularName: 'MS',
  aliases: ['MS', 'ms', 'Mandado de Segurança', 'Lei 12016', 'Lei 12.016'],
  ementa: 'Disciplina o mandado de segurança individual e coletivo e dá outras providências.',
  publicationDate: '2009-08-10',
  versionDate: '2009-08-07',
  sourceFile: 'legal/sources/ms2009/l12016.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
