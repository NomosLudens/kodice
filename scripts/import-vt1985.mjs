#!/usr/bin/env node
/**
 * import-vt1985.mjs
 *
 * Importador da Lei 7.418/1985 (Lei do Vale-Transporte) a partir do
 * snapshot oficial do Planalto (texto consolidado). Reutiliza o
 * parser genérico `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('vt1985', {
  title: 'Lei do Vale-Transporte',
  urn: 'urn:lex:br:federal:lei:1985-12-16;7418',
  type: 'lei',
  year: 1985, number: '7418',
  popularName: 'VT',
  aliases: ['VT', 'vt', 'Vale-Transporte', 'Lei 7418', 'Lei 7.418'],
  ementa: 'Institui o Vale-Transporte, e dá outras providências.',
  publicationDate: '1985-12-17', versionDate: '1985-12-16',
  sourceFile: 'legal/sources/vt1985/l7418compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l7418compilado.htm',
});
