#!/usr/bin/env node
/**
 * import-loas1993.mjs
 *
 * Importador da Lei 8.742/1993 (Lei Orgânica da Assistência Social
 * — LOAS) a partir do snapshot oficial do Planalto. Reutiliza o parser
 * genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('loas1993', {
  title: 'Lei Orgânica da Assistência Social',
  urn: 'urn:lex:br:federal:lei:1993-12-07;8742',
  type: 'lei',
  year: 1993, number: '8742',
  popularName: 'LOAS',
  aliases: ['LOAS', 'loas', 'Lei 8742', 'Lei 8.742', 'Assistência Social', 'BPC', 'Benefício de Prestação Continuada', 'LOAS Lei Orgânica'],
  ementa: 'Dispõe sobre a organização da Assistência Social e dá outras providências.',
  publicationDate: '1993-12-08', versionDate: '1993-12-07',
  sourceFile: 'legal/sources/loas1993/l8742compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm',
});
