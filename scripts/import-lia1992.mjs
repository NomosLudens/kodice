#!/usr/bin/env node
/**
 * import-lia1992.mjs
 *
 * Importador da Lei de Improbidade Administrativa (Lei 8.429/1992) a
 * partir do snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('lia1992', {
  title: 'Lei de Improbidade Administrativa',
  urn: 'urn:lex:br:federal:lei:1992-06-02;8429',
  type: 'lei',
  year: 1992,
  number: '8429',
  popularName: 'LIA',
  aliases: ['LIA', 'lia', 'Lei 8429', 'Lei 8.429', 'Improbidade Administrativa'],
  ementa: 'Dispõe sobre as sanções aplicáveis aos agentes públicos nos casos de enriquecimento ilícito no exercício de mandato, cargo, emprego ou função na administração pública direta, indireta ou fundacional.',
  publicationDate: '1992-06-03',
  versionDate: '1992-06-02',
  sourceFile: 'legal/sources/lia1992/l8429.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
