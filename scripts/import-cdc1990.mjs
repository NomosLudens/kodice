#!/usr/bin/env node
/**
 * import-cdc1990.mjs
 *
 * Importador do Código de Defesa do Consumidor (Lei 8.078/1990) a partir
 * do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cdc1990', {
  title: 'Código de Defesa do Consumidor',
  urn: 'urn:lex:br:federal:lei:1990-09-11;8078',
  type: 'lei',
  year: 1990,
  number: '8078',
  popularName: 'Código de Defesa do Consumidor',
  aliases: [
    'CDC', 'Codigo de Defesa do Consumidor', 'Código de Defesa do Consumidor',
    'Lei 8078', 'Lei 8.078', 'lei-8078', 'lei-8-078',
  ],
  ementa: 'Dispõe sobre a proteção do consumidor e dá outras providências.',
  publicationDate: '1990-09-12',
  versionDate: '1990-09-11',
  sourceFile: 'legal/sources/cdc1990/l8078compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
