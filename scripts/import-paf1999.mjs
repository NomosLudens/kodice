#!/usr/bin/env node
/**
 * import-paf1999.mjs
 *
 * Importador da Lei 9.784/1999 (Processo Administrativo Federal) a
 * partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('paf1999', {
  title: 'Lei do Processo Administrativo Federal',
  urn: 'urn:lex:br:federal:lei:1999-01-29;9784',
  type: 'lei',
  year: 1999,
  number: '9784',
  popularName: 'PAF',
  aliases: ['PAF', 'paf', 'Processo Administrativo', 'Lei 9784', 'Lei 9.784', 'Lei do Processo Administrativo'],
  ementa: 'Regula o processo administrativo no âmbito da Administração Pública Federal.',
  publicationDate: '1999-02-01',
  versionDate: '1999-01-29',
  sourceFile: 'legal/sources/paf1999/l9784.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
