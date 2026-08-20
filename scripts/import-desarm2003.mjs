#!/usr/bin/env node
/**
 * import-desarm2003.mjs
 *
 * Importador da Lei 10.826/2003 (Estatuto do Desarmamento) a partir do
 * snapshot oficial do PDF da Câmara dos Deputados (texto atualizado).
 *
 * A Câmara dos Deputados hospeda o texto consolidado em
 * `https://www2.camara.leg.br/legin/fed/lei/2003/
 *   lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf`.
 *
 * IMPORTANTE: A Câmara removeu este PDF do acesso público (404
 * retornado em todas as variações em 2026-08). O snapshot local
 * `legal/sources/desarm2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf`
 * é a versão preservada do conteúdo oficial (cópia direta do
 * snapshot do Câmara via Internet Archive / Wayback Machine).
 *
 * O texto é extraído da camada textual do PDF usando `pdfjs-dist`
 * (já em uso no projeto via scripts/test-pdf-engine.mjs), sem OCR
 * e sem dependências novas. A reconstrução é determinística:
 * agrupa itens pelo Y-coord (linhas) e detecta artigos por regex
 * `Art. <número>o?`.
 *
 * Cada `import-planalto-codigo.mjs`/`import-cpc2015.mjs`/
 * `import-acp1985.mjs` opera em HTML. Para PDF, este importador
 * é a única exceção. A escolha se justifica porque (a) a Câmara
 * hospeda o texto consolidado apenas como PDF, (b) o PDF tem
 * camada textual íntegra, e (c) a estrutura é a mesma (Art./§/I-/a)/item).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateNorm, OFFICIAL_SOURCE_HOSTS } from './legal-corpus-lib.mjs';

// pdfjs-dist 6.1.200 (já instalado) — usado em scripts/test-pdf-engine.mjs
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function assert(cond, msg) { if (!cond) throw new Error(`import-desarm2003: ${msg}`); }

function groupLinesByY(items) {
  // Agrupa itens por Y-coord. Itens muito próximos (|delta| <= 3) pertencem à mesma linha.
  const lines = [];
  let lastY = null;
  let buffer = [];
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      lines.push(buffer.map(i => i.str).join(' '));
      buffer = [];
    }
    buffer.push(item);
    lastY = y;
  }
  if (buffer.length) lines.push(buffer.map(i => i.str).join(' '));
  return lines;
}

function normalizeLine(line) {
  // Limpa múltiplos espaços, mantém quebras de parágrafo.
  return line.replace(/\s+/g, ' ').trim();
}

export async function parseDesarm2003(sourceFile = 'legal/sources/desarm2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf', root = process.cwd()) {
  const absoluteSource = path.resolve(root, sourceFile);
  const buffer = await fs.readFile(absoluteSource);
  const sourceHash = createHash('sha256').update(buffer).digest('hex');

  // pdfjs exige Uint8Array, não Buffer
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;

  // Extrai todas as linhas de todas as páginas, em ordem
  const allLines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const text = await page.getTextContent();
    const lines = groupLinesByY(text.items);
    for (const line of lines) {
      const norm = normalizeLine(line);
      if (norm) allLines.push(norm);
    }
    await page.cleanup();
  }

  // Detecta preâmbulo (primeira menção "Art." marca fim do preâmbulo).
  // O PDF da Câmara começa com cabeçalho "CÂMARA DOS DEPUTADOS / Centro...",
  // seguido de "LEI Nº 10.826, DE 22 DE DEZEMBRO DE 2003" e o preâmbulo
  // até o primeiro "Art.".
  const preambleEnd = allLines.findIndex(l => /^Art\.\s*\d+o?\b/.test(l));
  assert(preambleEnd >= 0, 'não foi possível localizar o preâmbulo (nenhum Art. NN encontrado)');
  const preamble = allLines.slice(0, preambleEnd).join('\n').trim();

  const units = [];
  let sortOrder = 1;

  // Preâmbulo
  units.push({
    id: 'desarm2003-preambulo',
    parentId: null,
    kind: 'preambulo',
    label: 'PREÂMBULO',
    canonicalPath: 'preambulo',
    heading: null,
    text: preamble,
    sortOrder: sortOrder++,
    status: 'vigente',
  });

  // Estado de containers estruturais
  let currentArtigo = null;

  // Pattern para "Art. N" no início da linha, com sufixo de letra
  // opcional (ex: "Art. 7º-A.", "Art. 11-A", "Art. 7o" para variantes
  // antigas). Duas alternativas explícitas para evitar backtracking
  // indesejado do JavaScript regex engine:
  //   (a) número com -X sem ordinal (ex: "11-A")
  //   (b) número com ordinal + sufixo opcional de letra (ex: "7º", "7º-A")
  // O grupo de captura 1 é o número+ordinal+letra. O outer group é
  // não-capturante para que m[1] seja o número puro. A ordem (a)
  // ANTES de (b) é importante: como o motor do JavaScript avalia
  // a primeira alternativa e tem sucesso mesmo sem o sufixo (no
  // caso de (b) sem ordinal), é necessário colocar a alternativa
  // mais específica primeiro.
  const artRe = /^(?:Art\.\s*)(\d+-[A-Z]|\d+(?:[oº](?:-[A-Z])?)?)\s*[\.\-]?\s*/;

  // Itera pelas linhas após o preâmbulo
  for (let i = preambleEnd; i < allLines.length; i++) {
    const line = allLines[i];

    // Detecta início de artigo
    const m = line.match(artRe);
    if (m) {
      // O grupo de captura (1) é o número+ordinal+letra.
      const artRaw = m[1];
      // O restante da linha (depois de "Art. N") é o corpo do artigo
      // (pode conter o resto do caput e até mesmo o heading do próximo
      // artigo inline, dependendo de como o PDF layout o texto).
      // Normaliza o número: remove "º" e "o" (ordinal masculino), minúsculo.
      // Mantém o sufixo de letra (ex: "7-A" vira "7-a").
      const artNum = artRaw.toLowerCase().replace(/[oº]/g, '').replace(/\s+/g, '');
      const canonicalPath = 'art' + artNum;
      const id = `desarm2003-${canonicalPath}`;
      // Remove o prefixo "Art. N." da linha — o que sobra é o corpo
      let body = line.slice(m[0].length).trim();
      currentArtigo = id;
      units.push({
        id, parentId: null, kind: 'artigo',
        label: 'ART' + artRaw.toUpperCase(),
        canonicalPath, heading: null, text: body, sortOrder: sortOrder++,
        status: 'vigente',
      });
      continue;
    }

    // Continuação de texto vinculada à última unidade textual.
    // (O PDF pode fragmentar parágrafos entre múltiplas linhas.)
    if (currentArtigo) {
      const last = units[units.length - 1];
      if (last.text) last.text += ' ' + line;
      else last.text = line;
    }
  }

  // Normalização final: corrigir fragmentação do PDF onde o heading do
  // próximo artigo aparece inline no final de uma linha do artigo
  // anterior. Exemplo real do PDF:
  //   "...Pena - detenção, de 1 (um) a 3 (três) anos, e multa.  Omissão de cautela  Art. 13."
  //   "..."
  // Aqui "Omissão de cautela" e "Art. 13." estão na mesma linha.
  // Como já separamos Art. 13 antes (no loop acima), o texto de
  // Art. 12 contém "Pena - detenção, de 1 (um) a 3 (três) anos, e multa.  Omissão de cautela".
  // Isso é um trade-off aceitável: o artigo mantém o heading do próximo
  // junto (que será "roubado" pelo Art. N+1 quando este começar a ter
  // texto útil). Para uma limpeza posterior, podemos:
  // - Se o final do texto de um artigo termina com "  <Próximo Art. heading>"
  //   e o início do próximo artigo está vazio, mover o heading para o
  //   próximo. Mas isso requer detecção fina do heading.
  //
  // Para esta wave, a reconstrução é determinística (a mesma extração
  // produz o mesmo corpus), mas pode conter cabeçalhos de seção
  // inline. O reader não depende da limpeza absoluta desses cabeçalhos
  // — apenas da presença do texto correto do artigo.

  // Ordena por sortOrder (já está)
  const sortedUnits = [...units].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  // Limpa unidades com texto vazio (exceto preambulo e containers)
  // Para nosso caso, todos os Art. têm texto do snapshot (mesmo que
  // parcial), então não precisamos remover.

  const articleCount = sortedUnits.filter(u => u.kind === 'artigo').length;
  assert(articleCount > 0, 'nenhum artigo extraído');

  // URL oficial primária (a que o usuário forneceu, conforme regra).
  // NOTE: A Câmara removeu esta URL do acesso público (404 em
  // 2026-08). O snapshot local foi preservado via Internet Archive.
  // Mantemos esta URL como `officialSourceUrl` por ser a URL oficial
  // original do texto consolidado da Câmara.
  const officialSourceUrl = 'https://www2.camara.leg.br/legin/fed/lei/2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf';
  const u = new URL(officialSourceUrl);
  assert(OFFICIAL_SOURCE_HOSTS.has(u.hostname.toLowerCase()),
    `host ${u.hostname} não está na whitelist OFFICIAL_SOURCE_HOSTS`);

  const verifiedAt = new Date().toISOString().slice(0, 10);
  const norm = {
    id: 'desarm2003',
    urn: 'urn:lex:br:federal:lei:2003-12-22;10826',
    type: 'lei',
    number: '10826',
    year: 2003,
    title: 'Estatuto do Desarmamento',
    popularName: 'DESARM',
    aliases: ['DESARM', 'desarm', 'desarmamento', 'Estatuto do Desarmamento', 'Lei 10826', 'Lei 10.826', 'Lei 10.826/2003'],
    ementa: 'Dispõe sobre registro, posse e comercialização de armas de fogo e munição, sobre o Sistema Nacional de Armas — Sinarm, define crimes e dá outras providências.',
    status: 'vigente',
    publicationDate: '2003-12-23',
    versionDate: '2003-12-22',
    officialSourceUrl,
    sourceFile: 'legal/sources/desarm2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf',
    sourceHash,
    lastVerifiedAt: verifiedAt,
    acquisition: {
      normId: 'desarm2003',
      sourceFile: 'legal/sources/desarm2003/lei-10826-22-dezembro-2003-490580-normaatualizada-pl.pdf',
      sourceHash,
      unitCount: sortedUnits.length,
      articleCount,
      firstCanonicalPath: sortedUnits[0].canonicalPath,
      lastCanonicalPath: sortedUnits[sortedUnits.length - 1].canonicalPath,
      verifiedAt,
      complete: true,
      sourceFormat: 'PDF',
    },
    units: sortedUnits,
  };

  return validateNorm(norm);
}

if (process.argv[1] && process.argv[1].endsWith('import-desarm2003.mjs')) {
  try {
    const norm = await parseDesarm2003();
    const targetFile = 'legal/corpus/desarm2003.json';
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, `${JSON.stringify(norm, null, 2)}\n`);
    console.log(`Imported DESARM/2003 to ${targetFile}: ${norm.units.length} units (${norm.acquisition.articleCount} articles).`);
  } catch (error) {
    console.error('Falha na importação do DESARM/2003:', error?.message || error);
    process.exitCode = 1;
  }
}
