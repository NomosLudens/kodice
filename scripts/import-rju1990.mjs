#!/usr/bin/env node
/**
 * import-rju1990.mjs
 *
 * Importador da Lei 8.112/1990 (Regime Jurídico dos Servidores Públicos
 * Civis da União) a partir do snapshot oficial do Planalto (texto
 * compilado). Reutiliza o parser genérico `import-planalto-codigo.mjs`.
 *
 * O snapshot é longo (~340KB) e contém 250 artigos com letras de sufixo
 * (ex: Art. 60-A), revogações e dispositivos alterados por leis
 * posteriores. A parser Planalto genérica já trata a estrutura via
 * regex `\d+(?:-\w+)?` para artigos com sufixo de letra.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('rju1990', {
  title: 'Estatuto do Servidor Público Federal',
  urn: 'urn:lex:br:federal:lei:1990-12-11;8112',
  type: 'lei',
  year: 1990,
  number: '8112',
  popularName: 'RJU',
  aliases: ['RJU', 'rju', 'Estatuto do Servidor', 'Estatuto do Servidor Público', 'Servidor Público Federal', 'Lei 8112', 'Lei 8.112'],
  ementa: 'Dispõe sobre o regime jurídico dos servidores públicos civis da União, das autarquias e das fundações públicas federais.',
  publicationDate: '1990-12-12',
  versionDate: '1990-12-11',
  sourceFile: 'legal/sources/rju1990/l8112compilado.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112compilado.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
