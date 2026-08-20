#!/usr/bin/env node
/**
 * import-clt1943.mjs
 *
 * Importador da Consolidação das Leis do Trabalho (Decreto-Lei 5.452/1943)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('clt1943', {
  title: 'Consolidação das Leis do Trabalho',
  urn: 'urn:lex:br:federal:decreto.lei:1943-05-01;5452',
  type: 'decreto-lei',
  year: 1943,
  number: '5452',
  popularName: 'CLT',
  aliases: [
    'CLT', 'Decreto-Lei 5452', 'DL 5452',
  ],
  ementa: 'Aprova a Consolidação das Leis do Trabalho.',
  publicationDate: '1943-09-09',
  versionDate: '1943-05-01',
  sourceFile: 'legal/sources/clt1943/del5452compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',
  startMarker: 'CONSOLIDAÇÃO DAS LEIS DO TRABALHO',
  endMarkers: ['Brasília,', 'DOU'],
});
