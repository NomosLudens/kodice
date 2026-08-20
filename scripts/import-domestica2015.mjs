#!/usr/bin/env node
/**
 * import-domestica2015.mjs
 *
 * Importador da Lei Complementar 150/2015 (LC do Empregado
 * Doméstico) a partir do snapshot oficial do Planalto. type=
 * 'lei.complementar' preservado (campo livre no schema). Reutiliza
 * o parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('domestica2015', {
  title: 'LC do Empregado Doméstico',
  urn: 'urn:lex:br:federal:lei.complementar:2015-06-02;150',
  type: 'lei.complementar',
  year: 2015, number: '150',
  popularName: 'DOMESTICA',
  aliases: ['DOMESTICA', 'domestica', 'Empregado Doméstico', 'LC 150', 'LC 150/2015', 'Lei Complementar 150', 'Doméstica Lei Complementar'],
  ementa: 'Dispõe sobre o contrato de trabalho doméstico; e dá outras providências.',
  publicationDate: '2015-06-03', versionDate: '2015-06-02',
  sourceFile: 'legal/sources/domestica2015/lcp150.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp150.htm',
});
