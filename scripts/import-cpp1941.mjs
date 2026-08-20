#!/usr/bin/env node
/**
 * import-cpp1941.mjs
 *
 * Importador do Código de Processo Penal (Decreto-Lei 3.689/1941) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cpp1941', {
  title: 'Código de Processo Penal',
  urn: 'urn:lex:br:federal:decreto.lei:1941-10-03;3689',
  type: 'decreto-lei',
  year: 1941,
  number: '3689',
  popularName: 'Código de Processo Penal',
  aliases: [
    'CPP', 'Codigo de Processo Penal', 'Código de Processo Penal',
    'Decreto-Lei 3689', 'DL 3689', 'lei 3689', 'Lei 3689',
  ],
  ementa: 'Código de Processo Penal.',
  publicationDate: '1941-10-13',
  versionDate: '1941-10-03',
  sourceFile: 'legal/sources/cpp1941/del3689compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
