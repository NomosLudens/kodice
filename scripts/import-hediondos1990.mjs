#!/usr/bin/env node
/**
 * import-hediondos1990.mjs
 *
 * Importador da Lei 8.072/1990 (Crimes Hediondos) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('hediondos1990', {
  title: 'Lei dos Crimes Hediondos',
  urn: 'urn:lex:br:federal:lei:1990-07-25;8072',
  type: 'lei',
  year: 1990,
  number: '8072',
  popularName: 'HEDIONDOS',
  aliases: ['HEDIONDOS', 'hediondos', 'Crimes Hediondos', 'Lei 8072', 'Lei 8.072', 'Hediondo'],
  ementa: 'Dispõe sobre os crimes hediondos, nos termos do art. 5º, inciso XLIII, da Constituição Federal, e determina outras providências.',
  publicationDate: '1990-07-26',
  versionDate: '1990-07-25',
  sourceFile: 'legal/sources/hediondos1990/l8072.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8072.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
