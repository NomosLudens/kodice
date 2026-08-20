#!/usr/bin/env node
/**
 * import-adiadc1999.mjs
 *
 * Importador da Lei 9.868/1999 (ADI / ADC) a partir do snapshot oficial
 * do Planalto. Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('adiadc1999', {
  title: 'Lei da ADI e ADC',
  urn: 'urn:lex:br:federal:lei:1999-11-10;9868',
  type: 'lei',
  year: 1999,
  number: '9868',
  popularName: 'ADI/ADC',
  aliases: ['ADI', 'ADC', 'adi', 'adc', 'Lei 9868', 'Lei 9.868', 'Lei ADI', 'Lei ADC'],
  ementa: 'Dispõe sobre o processo de julgamento, perante o Supremo Tribunal Federal, das ações diretas de inconstitucionalidade e das ações declaratórias de constitucionalidade.',
  publicationDate: '1999-11-11',
  versionDate: '1999-11-10',
  sourceFile: 'legal/sources/adiadc1999/l9868.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l9868.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
