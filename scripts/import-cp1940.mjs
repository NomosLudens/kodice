#!/usr/bin/env node
/**
 * import-cp1940.mjs
 *
 * Importador do Código Penal (Decreto-Lei 2.848/1940) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cp1940', {
  title: 'Código Penal',
  urn: 'urn:lex:br:federal:decreto.lei:1940-12-07;2848',
  type: 'decreto-lei',
  year: 1940,
  number: '2848',
  popularName: 'Código Penal',
  aliases: [
    'CP', 'Codigo Penal', 'Código Penal',
    'Decreto-Lei 2848', 'DL 2848',
  ],
  ementa: 'Código Penal.',
  publicationDate: '1940-12-07',
  versionDate: '1940-12-07',
  sourceFile: 'legal/sources/cp1940/del2848compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
