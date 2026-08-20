#!/usr/bin/env node
/**
 * import-cf88.mjs
 *
 * Importador determinístico da Constituição Federal de 1988 a partir do
 * snapshot oficial do Planalto (HTML ISO-8859-1).
 *
 * Estrutura da CF:
 *   - Preâmbulo
 *   - Art. 1 a Art. 250 (corpo)
 *   - Parágrafos: § 1º, § 2º, ... § N (ou Parágrafo único)
 *   - Incisos: I -, II -, ..., XXXV - (em Artigos ou Parágrafos)
 *   - Alíneas: a), b), c) (em Incisos ou diretamente)
 *   - Não há estrutura de Título/Capítulo formal no HTML do Planalto.
 *
 * O CF é registrado no catálogo como id "cf88" (kind: legislation).
 *
 * Sem fallback para fontes secundárias. Sem LLM. Sem mock.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateNorm } from './legal-corpus-lib.mjs';

const SOURCE_FILE = 'legal/sources/cf88/constituicao.htm';
const OUT_FILE = 'legal/corpus/cf88.json';

const OFFICIAL_URL = 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm';

function assert(cond, msg) { if (!cond) throw new Error(`import-cf88: ${msg}`); }

const root = process.cwd();
const absoluteSource = path.resolve(root, SOURCE_FILE);
const buffer = await fs.readFile(absoluteSource);
const sourceHash = createHash('sha256').update(buffer).digest('hex');

// Decode ISO-8859-1 (Planalto emite em latin1 com bytes 0xA0-0xFF).
// O Node representa latin1 como string JS onde cada char é o ponto de
// código latin1 (0xF3 = 'ó', 0xC7 = 'Ç', etc.). Usamos latin1 direto.
const text = buffer.toString('latin1');

assert(text.includes('Art. 5'), 'snapshot missing Art. 5 marker');

// Extrai parágrafos <p>. Planalto emite <p style="text-indent: 38px">, etc.
const pMatches = [...text.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
const paras = pMatches
  .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean);

assert(paras.length > 100, `not enough paragraphs (${paras.length})`);

// Localiza o preâmbulo — Planalto emite "Nós, representantes do povo".
// O texto está em ISO-8859-1; ao converter para UTF-8 os bytes altos viram
// caracteres de replacement (ex: "ó" → "Ã³"). Usamos regex tolerante.
const preambleIdx = paras.findIndex(p => /N[^\s,]{1,3}s,?\s*representantes do povo/i.test(p));
assert(preambleIdx >= 0, 'preamble not found');

// Localiza o início do ADCT (caso esteja no snapshot, parar antes dele).
// O cabeçalho do ADCT está em CAIXA ALTA ("ATO DAS DISPOSIÇÕES..."). As
// menções espalhadas pelo corpo do CF são minúsculas ("Ato das Disposições")
// e devem ser ignoradas.
const adctIdx = paras.findIndex((p, i) => i > preambleIdx && /ATO DAS DISPOSI[ÇC][^\s]{1,3}ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS/.test(p));
const endIdx = adctIdx >= 0 ? adctIdx : paras.length;

// Encontra o índice do primeiro artigo
const firstArtIdx = paras.findIndex((p, i) => i > preambleIdx && /^Art\.\s*\d+/.test(p));
assert(firstArtIdx >= 0 && firstArtIdx < endIdx, 'first Art. not found');

const units = [];
let sortOrder = 1;

// 1. Preâmbulo
units.push({
  id: 'cf88-preambulo',
  parentId: null,
  kind: 'preambulo',
  label: 'PREAMBULO',
  canonicalPath: 'preambulo',
  heading: null,
  text: paras[preambleIdx],
  sortOrder: sortOrder++,
  status: 'vigente'
});

let currentArtigo = null;
let currentParagrafo = null;
let currentInciso = null;

// O HTML do CF pode ter versões antigas (emendas revogadas) repetidas.
// Coletamos as versões por canonicalPath e mantemos apenas a mais recente.
const articlesByCp = new Map();

for (let i = firstArtIdx; i < endIdx; i++) {
  const p = paras[i];

  // Artigo
  let m = p.match(/^Art\.\s*(\d+(?:-[A-Za-z]+)?)[ºo°]?\s*(.*)/);
  if (m) {
    const artNum = m[1].replace(/-([A-Za-z]+)$/, '-$1').toLowerCase();
    const canonicalPath = 'art' + artNum.replace(/-/g, '-');
    const id = 'cf88-' + canonicalPath;
    currentArtigo = id;
    currentParagrafo = null;
    currentInciso = null;
    articlesByCp.set(canonicalPath, { id, label: 'ART' + m[1].toUpperCase(), text: p });
    continue;
  }

  // Parágrafo: § N, § N., Parágrafo único
  m = p.match(/^§\s*(\d+)[ºo°]?[.\s]*(.*)/);
  if (m && currentArtigo && articlesByCp.has(currentArtigo.replace('cf88-', ''))) {
    const parNum = m[1];
    const parent = currentArtigo.replace('cf88-', '');
    const canonicalPath = `${parent}-par${parNum}`;
    const id = 'cf88-' + canonicalPath;
    currentParagrafo = id;
    currentInciso = null;
    // Stash parágrafo no buffer do artigo atual
    const artBuf = articlesByCp.get(parent);
    if (!artBuf.children) artBuf.children = new Map();
    artBuf.children.set(canonicalPath, { id, parentId: currentArtigo, kind: 'paragrafo', label: 'PAR' + parNum, text: p });
    continue;
  }
  m = p.match(/^Par[áa]grafo [úu]nico[.\s]*(.*)/i);
  if (m && currentArtigo && articlesByCp.has(currentArtigo.replace('cf88-', ''))) {
    const parent = currentArtigo.replace('cf88-', '');
    const canonicalPath = `${parent}-parunico`;
    const id = 'cf88-' + canonicalPath;
    currentParagrafo = id;
    currentInciso = null;
    const artBuf = articlesByCp.get(parent);
    if (!artBuf.children) artBuf.children = new Map();
    artBuf.children.set(canonicalPath, { id, parentId: currentArtigo, kind: 'paragrafo', label: 'PARUNICO', text: p });
    continue;
  }

  // Inciso: I -, II -, III -, ..., LXXVIII -
  m = p.match(/^([IVX]+)\s*[-–]\s*(.*)/);
  if (m && (currentArtigo || currentParagrafo)) {
    const incNum = m[1].toLowerCase();
    const parent = currentParagrafo || currentArtigo;
    const parentCp = parent.replace('cf88-', '');
    const canonicalPath = `${parentCp}-inc${incNum}`;
    const id = 'cf88-' + canonicalPath;
    currentInciso = id;
    // Acha o article buffer
    let artCp = currentArtigo ? currentArtigo.replace('cf88-', '') : null;
    let parCp = currentParagrafo ? currentParagrafo.replace('cf88-', '') : null;
    if (artCp && articlesByCp.has(artCp)) {
      const artBuf = articlesByCp.get(artCp);
      if (!artBuf.flatChildren) artBuf.flatChildren = new Map();
      artBuf.flatChildren.set(canonicalPath, { id, parentId: parent, kind: 'inciso', label: 'INC' + incNum.toUpperCase(), text: p });
    }
    continue;
  }

  // Alínea: a), b), c)
  m = p.match(/^([a-z])\)\s*(.*)/);
  if (m && currentInciso) {
    const alLetter = m[1];
    const incCp = currentInciso.replace('cf88-', '');
    const baseCp = `${incCp}-ali${alLetter}`;
    let canonicalPath = baseCp;
    let id = 'cf88-' + canonicalPath;
    let artCp = currentArtigo ? currentArtigo.replace('cf88-', '') : null;
    if (artCp && articlesByCp.has(artCp)) {
      const artBuf = articlesByCp.get(artCp);
      if (!artBuf.flatChildren) artBuf.flatChildren = new Map();
      // Allow multiple alineas with same letter (suffix)
      let suffix = 0;
      while (artBuf.flatChildren.has(canonicalPath)) {
        suffix += 1;
        canonicalPath = `${baseCp}-${suffix}`;
        id = 'cf88-' + canonicalPath;
      }
      artBuf.flatChildren.set(canonicalPath, { id, parentId: currentInciso, kind: 'alinea', label: 'ALI' + alLetter.toUpperCase() + (suffix ? `-${suffix}` : ''), text: p });
    }
    continue;
  }

  // Continuação de texto na última unidade textual. Pode ser uma linha
  // dentro do artigo (parágrafos, incisos ou texto do próprio caput).
  if (currentArtigo) {
    const artCp = currentArtigo.replace('cf88-', '');
    if (articlesByCp.has(artCp)) {
      const artBuf = articlesByCp.get(artCp);
      // Anexa ao último item textual aberto (parágrafo > inciso > artigo)
      if (artBuf.children && currentParagrafo) {
        const parCp = currentParagrafo.replace('cf88-', '');
        if (artBuf.children.has(parCp)) {
          artBuf.children.get(parCp).text += ' ' + p;
        }
      } else if (artBuf.flatChildren && currentInciso) {
        const incCp = currentInciso.replace('cf88-', '');
        if (artBuf.flatChildren.has(incCp)) {
          artBuf.flatChildren.get(incCp).text += ' ' + p;
        }
      } else {
        artBuf.text += ' ' + p;
      }
    }
  }
}

// Agora materializa as unidades em ordem estável por canonicalPath
const sortedArticles = [...articlesByCp.entries()]
  .map(([cp, buf]) => {
    // Helper para extrair número do cp "art5", "art5-a", "art1072"
    const m = cp.match(/^art(\d+)(?:-([a-z]+))?$/);
    if (!m) return { cp, num: Infinity, buf };
    return { cp, num: parseInt(m[1], 10), suffix: m[2] || '', buf };
  })
  .sort((a, b) => a.num - b.num || a.suffix.localeCompare(b.suffix));

for (const { cp, buf } of sortedArticles) {
  units.push({
    id: buf.id,
    parentId: null,
    kind: 'artigo',
    label: buf.label,
    canonicalPath: cp,
    heading: null,
    text: buf.text,
    sortOrder: sortOrder++,
    status: 'vigente'
  });
  // Parágrafos
  if (buf.children) {
    const sortedChildren = [...buf.children.entries()]
      .map(([cCp, cBuf]) => {
        const m = cCp.match(/-par(\d+|unico)$/);
        return { cCp, num: m ? (m[1] === 'unico' ? -1 : parseInt(m[1], 10)) : 0, cBuf };
      })
      .sort((a, b) => a.num - b.num);
    for (const { cCp, cBuf } of sortedChildren) {
      units.push({
        id: cBuf.id,
        parentId: buf.id,
        kind: 'paragrafo',
        label: cBuf.label,
        canonicalPath: cCp,
        heading: null,
        text: cBuf.text,
        sortOrder: sortOrder++,
        status: 'vigente'
      });
    }
  }
  // Incisos e alíneas (flat)
  if (buf.flatChildren) {
    const sortedFlat = [...buf.flatChildren.entries()]
      .map(([cCp, cBuf]) => {
        const m = cCp.match(/-(inc|ali)(\w+?)(?:-\d+)?$/);
        return { cCp, kind: cBuf.kind, key: cBuf.kind === 'inciso' ? 1 : 2, num: m ? m[2] : '', cBuf };
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.key - b.key;
        return a.num.localeCompare(b.num);
      });
    for (const { cCp, cBuf } of sortedFlat) {
      units.push({
        id: cBuf.id,
        parentId: cBuf.parentId,
        kind: cBuf.kind,
        label: cBuf.label,
        canonicalPath: cCp,
        heading: null,
        text: cBuf.text,
        sortOrder: sortOrder++,
        status: 'vigente'
      });
    }
  }
}

const sortedUnits = [...units].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
const articleCount = sortedUnits.filter(u => u.kind === 'artigo').length;
assert(articleCount > 100, `expected > 100 articles, got ${articleCount}`);

const lastUnit = sortedUnits[sortedUnits.length - 1];
const firstArticle = sortedUnits.find(u => u.kind === 'artigo');
assert(firstArticle?.canonicalPath === 'art1', `first article must be art1, got ${firstArticle?.canonicalPath}`);
const art5 = sortedUnits.find(u => u.canonicalPath === 'art5');
assert(art5, 'art5 missing from corpus');
const lastArticle = sortedUnits.filter(u => u.kind === 'artigo').slice(-1)[0];
assert(lastArticle, 'last article missing');

const verifiedAt = new Date().toISOString();
const norm = {
  id: 'cf88',
  urn: 'urn:lex:br:federal:constituicao:1988-10-05;1988',
  type: 'constituicao',
  number: null,
  year: 1988,
  title: 'Constituição da República Federativa do Brasil de 1988',
  popularName: 'CF/88',
  aliases: ['cf88', 'cf', 'constituicao', 'constituicao federal'],
  ementa: 'Constituição da República Federativa do Brasil, promulgada em 5 de outubro de 1988.',
  status: 'vigente',
  publicationDate: '1988-10-05',
  versionDate: '1988-10-05',
  officialSourceUrl: OFFICIAL_URL,
  sourceFile: SOURCE_FILE,
  sourceHash,
  lastVerifiedAt: verifiedAt,
  acquisition: {
    normId: 'cf88',
    sourceFile: SOURCE_FILE,
    sourceHash,
    unitCount: sortedUnits.length,
    articleCount,
    firstCanonicalPath: sortedUnits[0].canonicalPath,
    lastCanonicalPath: lastUnit.canonicalPath,
    verifiedAt,
    complete: true
  },
  units: sortedUnits
};

const validated = validateNorm(norm);

await fs.mkdir(path.dirname(path.resolve(root, OUT_FILE)), { recursive: true });
await fs.writeFile(path.resolve(root, OUT_FILE), `${JSON.stringify(validated, null, 2)}\n`);

console.log(`[import-cf88] wrote ${OUT_FILE}`);
console.log(`[import-cf88] ${sortedUnits.length} units (${articleCount} articles)`);
console.log(`[import-cf88] first: ${sortedUnits[0].canonicalPath}, last: ${lastUnit.canonicalPath}`);
console.log(`[import-cf88] first article: ${firstArticle.canonicalPath}, last article: ${lastArticle.canonicalPath}`);
console.log(`[import-cf88] art5 present: ${!!art5}`);
console.log(`[import-cf88] sha256=${sourceHash}`);
