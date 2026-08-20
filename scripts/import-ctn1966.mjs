#!/usr/bin/env node
/**
 * import-ctn1966.mjs
 *
 * Importador do Código Tributário Nacional (Lei 5.172/1966) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('ctn1966', {
  title: 'Código Tributário Nacional',
  urn: 'urn:lex:br:federal:lei:1966-10-25;5172',
  type: 'lei',
  year: 1966,
  number: '5172',
  popularName: 'CTN',
  aliases: [
    'CTN', 'Lei 5172', 'Lei 5.172',
  ],
  ementa: 'Dispõe sobre o Sistema Tributário Nacional e institui normas gerais de direito tributário aplicáveis à União, Estados e Municípios.',
  publicationDate: '1966-10-27',
  versionDate: '1966-10-25',
  sourceFile: 'legal/sources/ctn1966/l5172compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
