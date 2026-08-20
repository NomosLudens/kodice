#!/usr/bin/env node
/**
 * import-bf1990.mjs
 *
 * Importador da Lei 8.009/1990 (Bem de Família) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('bf1990', {
  title: 'Lei do Bem de Família',
  urn: 'urn:lex:br:federal:lei:1990-03-13;8009',
  type: 'lei',
  year: 1990,
  number: '8009',
  popularName: 'BF',
  aliases: ['BF', 'bf', 'Bem de Família', 'Lei 8009', 'Lei 8.009'],
  ementa: 'Dispõe sobre a impenhorabilidade do bem de família.',
  publicationDate: '1990-03-15',
  versionDate: '1990-03-13',
  sourceFile: 'legal/sources/bf1990/l8009.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8009.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
