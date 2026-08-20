#!/usr/bin/env node
/**
 * import-abuso2019.mjs
 *
 * Importador da Lei 13.869/2019 (Abuso de Autoridade) a partir do
 * snapshot oficial do Planalto. Reutiliza o parser genérico
 * `import-planalto-codigo.mjs`.
 */
import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';

await importPlanaltoCodigo('abuso2019', {
  title: 'Lei de Abuso de Autoridade',
  urn: 'urn:lex:br:federal:lei:2019-09-05;13869',
  type: 'lei',
  year: 2019,
  number: '13869',
  popularName: 'ABUSO',
  aliases: ['ABUSO', 'abuso', 'Abuso de Autoridade', 'Lei 13869', 'Lei 13.869'],
  ementa: 'Dispõe sobre os crimes de abuso de autoridade; altera a Lei nº 7.960, de 21 de dezembro de 1989, a Lei nº 9.296, de 24 de julho de 1996, a Lei nº 8.069, de 13 de julho de 1990 (Estatuto da Criança e do Adolescente), a Lei nº 10.741, de 1º de outubro de 2003 (Estatuto do Idoso), a Lei nº 13.105, de 16 de março de 2015 (Código de Processo Civil), e o Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal); e revoga dispositivo da Lei nº 4.898, de 9 de dezembro de 1965.',
  publicationDate: '2019-09-05',
  versionDate: '2019-09-05',
  sourceFile: 'legal/sources/abuso2019/l13869.htm',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm',
  endMarkers: ['Brasília,', 'DOU'],
});
