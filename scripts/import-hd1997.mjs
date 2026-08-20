#!/usr/bin/env node
/**
 * import-hd1997.mjs
 *
 * Importador da Lei 9.507/1997 (Habeas Data) a partir do snapshot oficial
 * do Planalto. Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('hd1997', {
  title: 'Lei do Habeas Data',
  urn: 'urn:lex:br:federal:lei:1997-11-12;9507',
  type: 'lei',
  year: 1997,
  number: '9507',
  popularName: 'HD',
  aliases: ['HD', 'hd', 'Habeas Data', 'Lei 9507', 'Lei 9.507'],
  ementa: 'Regula o direito de acesso a informações e disciplinar o habeas data.',
  publicationDate: '1997-11-13',
  versionDate: '1997-11-12',
  sourceFile: 'legal/sources/hd1997/l9507.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9507.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
