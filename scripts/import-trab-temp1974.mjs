#!/usr/bin/env node
/**
 * import-trab-temp1974.mjs
 *
 * Importador da Lei 6.019/1974 (Lei do Trabalho Temporário) a
 * partir do snapshot oficial do Planalto (texto consolidado).
 * Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('trab-temp1974', {
  title: 'Lei do Trabalho Temporário',
  urn: 'urn:lex:br:federal:lei:1974-01-03;6019',
  type: 'lei',
  year: 1974, number: '6019',
  popularName: 'TRAB_TEMP',
  aliases: ['TRAB_TEMP', 'trab_temp', 'Trabalho Temporário', 'Lei 6019', 'Lei 6.019'],
  ementa: 'Regula o Trabalho Temporário nas Empresas Urbanas, e dá outras providências; e altera o Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal).',
  publicationDate: '1974-01-04', versionDate: '1974-01-03',
  sourceFile: 'legal/sources/trab-temp1974/l6019compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l6019compilado.htm',
});
