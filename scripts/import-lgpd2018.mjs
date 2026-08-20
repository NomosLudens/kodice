#!/usr/bin/env node
/**
 * import-lgpd2018.mjs
 *
 * Importador da Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018)
 * a partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lgpd2018', {
  title: 'Lei Geral de Proteção de Dados Pessoais',
  urn: 'urn:lex:br:federal:lei:2018-07-14;13709',
  type: 'lei',
  year: 2018,
  number: '13709',
  popularName: 'LGPD',
  aliases: [
    'LGPD', 'Lei 13709', 'Lei 13.709',
  ],
  ementa: 'Dispõe sobre a proteção de dados pessoais.',
  publicationDate: '2018-08-15',
  versionDate: '2018-07-14',
  sourceFile: 'legal/sources/lgpd2018/l13709.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
