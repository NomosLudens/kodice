#!/usr/bin/env node
/**
 * import-drogas2006.mjs
 *
 * Importador da Lei 11.343/2006 (Lei de Drogas) a partir do snapshot
 * oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('drogas2006', {
  title: 'Lei de Drogas',
  urn: 'urn:lex:br:federal:lei:2006-08-23;11343',
  type: 'lei',
  year: 2006,
  number: '11343',
  popularName: 'DROGAS',
  aliases: ['DROGAS', 'drogas', 'Lei de Drogas', 'Lei 11343', 'Lei 11.343', 'Tráfico de Drogas', 'Entorpecentes'],
  ementa: 'Institui o Sistema Nacional de Políticas Públicas sobre Drogas - SISNAD; prescreve medidas para prevenção do uso indevido, atenção e reinserção social de usuários e dependentes de drogas; estabelece normas para repressão da produção não autorizada e do tráfico ilícito de drogas; define crimes e dá outras providências.',
  publicationDate: '2006-08-24',
  versionDate: '2006-08-23',
  sourceFile: 'legal/sources/drogas2006/l11343.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
