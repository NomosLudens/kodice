#!/usr/bin/env node
/**
 * import-cf88-adct.mjs
 *
 * Importador do Ato das Disposições Constitucionais Transitórias (ADCT)
 * da Constituição Federal de 1988.
 *
 * O ADCT JÁ ESTÁ embutido no snapshot do CF/88 (em planalto.gov.br —
 * o planalto atualmente não serve uma URL dedicada para o ADCT isolado).
 * O `import-cf88.mjs` corta o parsing exatamente no cabeçalho
 * "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS" para manter o
 * CF/88 separado do ADCT.
 *
 * Esta wave reabre o mesmo snapshot a partir do cabeçalho do ADCT e
 * reaproveita o parser genérico `import-planalto-codigo.mjs` em modo
 * `noPreamble` (o ADCT não tem preâmbulo próprio).
 *
 * Reuso: o ADCT é um anexo da CF. Mesma fonte. Mesma estrutura (Art./§/I-/a)).
 * Sem parser constitucional duplicado.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('cf88-adct', {
  title: 'Ato das Disposições Constitucionais Transitórias',
  urn: 'urn:lex:br:federal:ato.disposicoes.constitucionais.transitorias:1988-10-05;1988',
  type: 'constituicao',
  year: 1988,
  number: '',
  popularName: 'ADCT',
  aliases: [
    'ADCT', 'adct', 'Disposições Constitucionais Transitórias', 'Ato das Disposições',
  ],
  ementa: 'Ato das Disposições Constitucionais Transitórias da Constituição Federal de 1988.',
  publicationDate: '1988-10-05',
  versionDate: '1988-10-05',
  sourceFile: 'legal/sources/cf88/constituicao.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
  startMarker: 'ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS',
  noPreamble: true,
  endMarkers: ['Brasília,'],
});
