#!/usr/bin/env node
/**
 * import-lindb.mjs
 *
 * Importador da Lei de Introdução às Normas do Direito Brasileiro
 * (Decreto-Lei 4.657/1942) a partir do snapshot oficial do Planalto.
 * Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lindb', {
  title: 'Lei de Introdução às Normas do Direito Brasileiro',
  urn: 'urn:lex:br:federal:decreto.lei:1942-08-31;4657',
  type: 'decreto-lei',
  year: 1942,
  number: '4657',
  popularName: 'LINDB',
  aliases: ['LINDB', 'lindb', 'Lei de Introdução', 'Lei 4.657'],
  ementa: 'Lei de Introdução ao Código Civil.',
  publicationDate: '1942-09-09',
  versionDate: '1942-08-31',
  sourceFile: 'legal/sources/lindb/del4657compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
