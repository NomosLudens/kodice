#!/usr/bin/env node
/**
 * import-eca1990.mjs
 *
 * Importador do Estatuto da Criança e do Adolescente (Lei 8.069/1990) a
 * partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('eca1990', {
  title: 'Estatuto da Criança e do Adolescente',
  urn: 'urn:lex:br:federal:lei:1990-07-13;8069',
  type: 'lei',
  year: 1990,
  number: '8069',
  popularName: 'ECA',
  aliases: [
    'ECA', 'Lei 8069', 'Lei 8.069',
  ],
  ementa: 'Dispõe sobre o Estatuto da Criança e do Adolescente.',
  publicationDate: '1990-07-16',
  versionDate: '1990-07-13',
  sourceFile: 'legal/sources/eca1990/l8069compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8069compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
