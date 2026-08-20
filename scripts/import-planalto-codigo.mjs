#!/usr/bin/env node
/**
 * import-planalto-codigo.mjs
 *
 * Importador determinístico genérico para códigos federais publicados no
 * Planalto (HTTPS) na forma "compilado/atualizado" (mesma estrutura HTML
 * dos códigos CC, CP, CPP, CDC, CLT, CTN, ECA, LGPD).
 *
 * Estrutura HTML Planalto reconhecida:
 *   - Preâmbulo: "O PRESIDENTE DA REPÚBLICA ... faço saber que o
 *     Congresso Nacional decreta e eu sanciono a seguinte lei:"
 *   - Encerramento: "Brasília, <data>" (opcional)
 *   - TÍTULO I, II, ... (centrado)
 *   - CAPÍTULO I, II, ... (centrado)
 *   - SEÇÃO I, II, ... (centrado)
 *   - LIVRO I, II, ... (centrado)
 *   - PARTE GERAL / PARTE ESPECIAL / PARTE ÚNICA
 *   - Art. N [ºo] texto
 *   - Parágrafo único / § N [ºo] texto
 *   - I -, II -, ... (incisos dentro de artigo ou parágrafo)
 *   - a), b), c) (alíneas dentro de inciso ou parágrafo)
 *
 * Encoding: ISO-8859-1 (Planalto emite em latin1 com bytes 0xA0-0xFF).
 * Sem fallback para fontes secundárias. Sem LLM. Sem mock.
 *
 * Uso:
 *   import { importPlanaltoCodigo } from './import-planalto-codigo.mjs';
 *   await importPlanaltoCodigo('cc2002', {
 *     title: 'Código Civil',
 *     urn: 'urn:lex:br:federal:lei:2002-01-10;10406',
 *     year: 2002,
 *     number: '10406',
 *     aliases: ['CC', 'CC2002', 'Código Civil', 'Lei 10.406'],
 *     ementa: 'Institui o Código Civil.',
 *     publicationDate: '2002-01-11',
 *     versionDate: '2002-01-10',
 *     sourceFile: 'legal/sources/cc2002/l10406.htm',
 *     sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406.htm',
 *     endMarkers: ['Brasília,', 'DOU'],
 *   });
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateNorm } from './legal-corpus-lib.mjs';

function assert(cond, msg) { if (!cond) throw new Error(`import-planalto-codigo: ${msg}`); }

const ROMAN = /^[IVXLCDM]+$/;

function toSlugRoman(s) {
  return s.toLowerCase();
}

function articlesToSortOrder(articles) {
  return articles;
}

export async function importPlanaltoCodigo(normId, config) {
  assert(normId && /^[a-z][a-z0-9-]*$/.test(normId), `invalid normId ${normId}`);
  for (const f of ['title','urn','year','aliases','ementa','publicationDate','versionDate','sourceFile','sourceUrl']) {
    assert(config[f] !== undefined, `missing config.${f}`);
  }
  const sourceFileAbs = path.resolve(process.cwd(), config.sourceFile);
  const buffer = await fs.readFile(sourceFileAbs);
  const sourceHash = createHash('sha256').update(buffer).digest('hex');
  // Planalto publica em ISO-8859-1 (latin1) na maioria dos casos, mas algumas
  // leis recentes (LMP/2006, LAI/2011, LBI/2015, LGPD/2018) saem em UTF-16
  // LE com BOM. Detecta encoding pelo BOM para preservar o snapshot bruto.
  // Node aceita 'utf16le' (sem hífen) e 'utf-8' mas não 'utf-16-le'.
  let text;
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    text = buffer.toString('utf16le');
  } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    text = buffer.toString('utf-8');
  } else {
    text = buffer.toString('latin1');
  }
  // Algum HTML do Planalto termina com whitespace ímpar que quebra o decoder
  // UTF-16-LE. Mantém apenas os bytes válidos; o HTML ainda é parseável.
  if (text.charCodeAt(text.length - 1) === 0xFFFD) {
    text = text.replace(/\uFFFD+$/g, '').replace(/\s+$/, '');
  }

  // Extrai parágrafos <p>. Planalto emite <p style="text-align: justify">,
  // <p style="text-align: center">, <p align="JUSTIFY">, etc.
  const pMatches = [...text.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paras = pMatches
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  assert(paras.length > 20, `${normId}: too few paragraphs (${paras.length})`);

  // Localiza o preâmbulo — "O PRESIDENTE DA REPÚBLICA" + "faço saber" /
  // "Os Ministros ... decreta" (decretos-lei) / "Congresso Nacional decreta".
  // Opt-out via config.noPreamble para normas-filhas (ex: ADCT dentro da CF)
  // que compartilham o snapshot da norma-mãe e não têm preâmbulo próprio.
  // O preâmbulo fica nos primeiros ~10 parágrafos do snapshot — busca
  // restrita para não casar parágrafos internos que citam o nome.
  let preambleIdx = -1;
  if (!config.noPreamble) {
    const P = Math.min(paras.length, 20);
    preambleIdx = paras.slice(0, P).findIndex(p =>
      /PRESIDENTE DA REP[ÚU]BLICA/i.test(p) ||
      /Congresso Nacional decreta/i.test(p) ||
      /decreta:/i.test(p) ||
      (/usando/i.test(p) && /atribui/i.test(p) && /decreta/i.test(p)) ||
      (/decreta/i.test(p) && /Lei n[º°]|Decreto-Lei n[º°]/i.test(p))
    );
    if (preambleIdx < 0) {
      // Fallback: parágrafo que contenha "decreta" + o tipo da norma (CÓDIGO/LEI/ESTATUTO/DECRETO).
      preambleIdx = paras.slice(0, P).findIndex(p => /decreta/i.test(p)
        && /\bCÓDIGO\b|\bLEI\b|\bESTATUTO\b|\bDECRETO\b/i.test(p));
    }
    assert(preambleIdx >= 0, `${normId}: preamble not found`);
  }

  // startMarker (opcional): marcador do início do conteúdo jurídico efetivo.
  // Necessário para normas com dois níveis (decreto-lei + consolidação) como
  // a CLT: o snapshot traz o DECRETO (Art. 1, Art. 2) e depois a Consolidação
  // (Art. 1º - ...). O conteúdo jurídico é a Consolidação, não o DECRETO.
  // O marcador deve ser EXATAMENTE o parágrafo (igualdade após normalização
  // de espaços), case-sensitive — para não casar parágrafos longos que
  // apenas citam o nome (ex: ADCT dentro de CF, cujo sumário usa
  // "Ato das Disposições..." em title case mas o cabeçalho da seção
  // usa "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS" em CAPS).
  let contentStart = config.noPreamble ? 0 : preambleIdx + 1;
  if (config.startMarker) {
    const target = config.startMarker.replace(/\s+/g, ' ').trim();
    const startIdx = paras.findIndex((p, i) => {
      if (!config.noPreamble && i < preambleIdx) return false;
      return p.replace(/\s+/g, ' ').trim() === target;
    });
    if (startIdx >= 0) {
      contentStart = startIdx + 1;
    }
  }

  // Encontra fim do conteúdo (Brasília, ou fim do arquivo).
  const endMarkers = config.endMarkers || ['Brasília,'];
  let endIdx = paras.length;
  for (let i = contentStart; i < paras.length; i++) {
    if (endMarkers.some(m => paras[i].startsWith(m) || paras[i].includes(m + ' '))) {
      endIdx = i;
      break;
    }
  }

  const verifiedAt = new Date().toISOString().slice(0, 10);
  const units = [];
  let sortOrder = 1;

  // Stack de containers estruturais (parte, livro, título, capítulo, seção).
  // Cada um vira uma unit com kind correspondente.
  const HIERARCHY = ['parte', 'livro', 'titulo', 'capitulo', 'secao', 'subsecao'];
  const stack = [];
  function pushContainer(kind, label, heading) {
    // Poda containers do mesmo nível ou mais profundos antes de inserir
    const kindLevel = HIERARCHY.indexOf(kind);
    while (stack.length) {
      const topLevel = HIERARCHY.indexOf(stack[stack.length - 1].kind);
      if (topLevel >= kindLevel) stack.pop();
      else break;
    }
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Hierarchical canonical path: inclui prefixo do pai para evitar colisão
    // entre SEÇÃO I de CAPÍTULO III e SEÇÃO I de CAPÍTULO IV.
    const parentCp = parentId ? parentId.replace(`${normId}-`, '') : '';
    const cp = parentCp ? `${parentCp}-${slug}` : slug;
    const id = `${normId}-${cp}`;
    // Se ainda houver colisão (ex: TÍTULO em páginas diferentes), sufixa contador.
    let finalCp = cp;
    let finalId = id;
    let n = 1;
    while (units.some(u => u.canonicalPath === finalCp)) {
      n += 1;
      finalCp = `${cp}-${n}`;
      finalId = `${normId}-${finalCp}`;
    }
    const u = {
      id: finalId, parentId, kind, label: label.toUpperCase(),
      canonicalPath: finalCp, heading, text: '', sortOrder: sortOrder++, status: 'vigente',
    };
    units.push(u);
    stack.push(u);
    return u;
  }
  function popContainer(kind) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].kind === kind) { stack.splice(i); return; }
    }
  }

  // Preâmbulo (opcional). Normas-filhas (ex: ADCT dentro de CF) não
  // possuem preâmbulo próprio — o preâmbulo já pertence à norma-mãe.
  if (!config.noPreamble) {
    units.push({
      id: `${normId}-preambulo`,
      parentId: null,
      kind: 'preambulo',
      label: 'PREAMBULO',
      canonicalPath: 'preambulo',
      heading: null,
      text: paras[preambleIdx],
      sortOrder: sortOrder++,
      status: 'vigente',
    });
  }

  // Estado corrente (containers já são tracked via stack; demais são "currentArticle").
  const currentArtigo = { id: null, children: null, flatChildren: null };
  const state = { paragrafo: null, inciso: null, lastTextual: null };

  for (let i = contentStart; i < endIdx; i++) {
    const p = paras[i];
    if (!p) continue;

    // PARTE GERAL / ESPECIAL / ÚNICA
    let m = p.match(/^PARTE\s+(GERAL|ESPECIAL|ÚNICA|UNICA|[IVX]+)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'PARTE ' + m[1].toUpperCase().replace('UNICA', 'ÚNICA');
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      // Limpa containers mais profundos
      stack.length = 0;
      pushContainer('parte', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // (No more heading patterns below — needs the special case to be first)

    // LIVRO I, II, ..., ÚNICO, COMPLEMENTAR
    m = p.match(/^LIVRO\s+([IVXLCDM]+|COMPLEMENTAR|ÚNICO|UNICO)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'LIVRO ' + m[1].toUpperCase().replace('UNICO', 'ÚNICO');
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      pushContainer('livro', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // TÍTULO I, II, ... (pode ser em romano ou arábico)
    m = p.match(/^T[ÍI]TULO\s+([IVXLCDM0-9]+)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'TITULO ' + m[1].toUpperCase();
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      pushContainer('titulo', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // CAPÍTULO I, II, ...
    m = p.match(/^CAP[ÍI]TULO\s+([IVXLCDM0-9]+)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'CAPITULO ' + m[1].toUpperCase();
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      pushContainer('capitulo', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // SEÇÃO I, II, ...
    m = p.match(/^SE[ÇC][ÃA]O\s+([IVXLCDM0-9]+)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'SECAO ' + m[1].toUpperCase();
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      pushContainer('secao', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // SUBSEÇÃO
    m = p.match(/^SUBSE[ÇC][ÃA]O\s+([IVXLCDM0-9]+)(?:\s+(.*))?$/i);
    if (m) {
      const label = 'SUBSECAO ' + m[1].toUpperCase();
      const heading = m[2] && m[2].trim() ? m[2].trim() : null;
      pushContainer('subsecao', label, heading);
      currentArtigo.id = null;
      state.paragrafo = null; state.inciso = null; state.lastTextual = null;
      continue;
    }

    // Artigo: "Art. N" (com sufixo opcional A/B, marcador ordinal º/o/°,
    // e separador de milhar "." para CC tipo "Art. 2.046").
    // Aceita: "Art. 1", "Art. 1º", "Art. 1o", "Art. 1º-A", "Art. 1-A",
    // "Art. 2.046", "Art. 1.999", "Art. 1º. A", "Art. 1º - A"
    m = p.match(/^Art\.\s*(\d{1,4}(?:\.\d{3})?(?:-\w+)?)\s*[ºo°ª.]?\s*[-–]?\s*(.*)/);
    if (m && /^\d/.test(m[1])) {
      // Normaliza: remove "." (separador de milhar) e lower-case para chave canônica.
      const numRaw = m[1];
      const num = numRaw.replace(/\./g, '').toLowerCase();
      const canonicalPath = 'art' + num;
      const id = `${normId}-${canonicalPath}`;
      // Verifica duplicata: o snapshot do compilado pode repetir artigos antigos
      // quando há revogação. Mantemos o último (mais recente).
      const existingIdx = units.findIndex(u => u.canonicalPath === canonicalPath && u.kind === 'artigo');
      if (existingIdx >= 0) {
        // Remove o antigo e seus descendentes.
        const oldId = units[existingIdx].id;
        units.splice(existingIdx, 1);
        for (let j = units.length - 1; j >= 0; j--) {
          if (units[j].parentId === oldId) units.splice(j, 1);
        }
      }
      const parentId = stack.length ? stack[stack.length - 1].id : null;
      const labelNum = numRaw.toUpperCase();
      const u = {
        id, parentId, kind: 'artigo', label: 'ART' + labelNum,
        canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
      };
      units.push(u);
      currentArtigo.id = id;
      currentArtigo.children = new Map();
      currentArtigo.flatChildren = new Map();
      state.paragrafo = null; state.inciso = null; state.lastTextual = u;
      continue;
    }

    // Parágrafo: § N ou Parágrafo único
    m = p.match(/^§\s*(\d+)\s*[ºo°ª.]?\s*(.*)/);
    if (m && currentArtigo.id) {
      const parNum = m[1];
      const artCp = currentArtigo.id.replace(`${normId}-`, '');
      const canonicalPath = `${artCp}-par${parNum}`;
      const id = `${normId}-${canonicalPath}`;
      // Se já existe (e.g., re-emitido por duplicação HTML), anexa texto
      const existing = units.find(u => u.canonicalPath === canonicalPath);
      if (existing) {
        existing.text += ' ' + p;
        state.paragrafo = id; state.inciso = null; state.lastTextual = existing;
      } else {
        const parU = {
          id, parentId: currentArtigo.id, kind: 'paragrafo',
          label: 'PAR' + parNum, canonicalPath, heading: null,
          text: p, sortOrder: sortOrder++, status: 'vigente',
        };
        units.push(parU);
        currentArtigo.children.set(canonicalPath, parU);
        state.paragrafo = id; state.inciso = null; state.lastTextual = parU;
      }
      continue;
    }
    m = p.match(/^Par[áa]grafo\s+[úu]nico\s*\.?\s*(.*)/i);
    if (m && currentArtigo.id) {
      const artCp = currentArtigo.id.replace(`${normId}-`, '');
      const canonicalPath = `${artCp}-parunico`;
      const id = `${normId}-${canonicalPath}`;
      const existing = units.find(u => u.canonicalPath === canonicalPath);
      if (existing) {
        existing.text += ' ' + p;
        state.paragrafo = id; state.inciso = null; state.lastTextual = existing;
      } else {
        const parU = {
          id, parentId: currentArtigo.id, kind: 'paragrafo',
          label: 'PARUNICO', canonicalPath, heading: null,
          text: p, sortOrder: sortOrder++, status: 'vigente',
        };
        units.push(parU);
        currentArtigo.children.set(canonicalPath, parU);
        state.paragrafo = id; state.inciso = null; state.lastTextual = parU;
      }
      continue;
    }

    // Inciso: I -, II -, ... (romanos), pode ser dentro de artigo ou parágrafo.
    m = p.match(/^([IVXLCDM]+)\s*[-–]\s*(.*)/);
    if (m && currentArtigo.id && ROMAN.test(m[1]) && m[1].length <= 12) {
      const inc = m[1].toLowerCase();
      const parentId = state.paragrafo || currentArtigo.id;
      const parentCp = parentId.replace(`${normId}-`, '');
      const canonicalPath = `${parentCp}-inc${inc}`;
      const id = `${normId}-${canonicalPath}`;
      const existing = units.find(u => u.canonicalPath === canonicalPath);
      if (existing) {
        existing.text += ' ' + p;
        state.inciso = id; state.lastTextual = existing;
      } else {
        const incU = {
          id, parentId, kind: 'inciso', label: 'INC' + m[1].toUpperCase(),
          canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
        };
        units.push(incU);
        currentArtigo.flatChildren.set(canonicalPath, incU);
        state.inciso = id; state.lastTextual = incU;
      }
      continue;
    }

    // Alínea: a), b), c), ..., dentro de inciso ou parágrafo.
    m = p.match(/^([a-z])\)\s*(.*)/);
    if (m && (state.inciso || (state.paragrafo && /^[a-z]\)/.test(p)))) {
      const al = m[1];
      let parentId, parentCp;
      if (state.inciso) {
        parentId = state.inciso;
        parentCp = state.inciso.replace(`${normId}-`, '');
      } else {
        parentId = state.paragrafo;
        parentCp = state.paragrafo.replace(`${normId}-`, '');
      }
      const baseCp = `${parentCp}-ali${al}`;
      let canonicalPath = baseCp;
      let id = `${normId}-${canonicalPath}`;
      let suffix = 0;
      while (units.some(u => u.canonicalPath === canonicalPath)) {
        suffix += 1;
        canonicalPath = `${baseCp}-${suffix}`;
        id = `${normId}-${canonicalPath}`;
      }
      const alU = {
        id, parentId, kind: 'alinea',
        label: 'ALI' + al.toUpperCase() + (suffix ? `-${suffix}` : ''),
        canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
      };
      units.push(alU);
      state.lastTextual = alU;
      continue;
    }

    // Continuação de texto na última unidade textual aberta.
    if (state.lastTextual) {
      state.lastTextual.text += ' ' + p;
    } else if (stack.length) {
      // Anexa ao container mais profundo (pode ser heading não extraído)
      const top = stack[stack.length - 1];
      if (top.text) top.text += ' ' + p;
      else top.text = p;
    }
  }

  // Garante integridade: cada unit precisa de id único.
  const seenIds = new Set();
  for (const u of units) {
    assert(!seenIds.has(u.id), `${normId}: duplicate unit id ${u.id}`);
    seenIds.add(u.id);
  }

  // Remove units cujo parentId não existe na lista. Este pass é uma rede de
  // segurança contra inconsistências de parsing quando o HTML mistura
  // estrutura de forma ambígua (ex: alínea órfã cujo parent foi reemitido).
  // A estrutura article→paragraph→inciso→alinea deve ser estritamente ligada.
  // Itera até estabilizar (cobre cadeias: avô removido → pai removido → neto
  // removido).
  let changed = true;
  while (changed) {
    changed = false;
    const byIdLocal = new Map(units.map(u => [u.id, u]));
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.parentId && !byIdLocal.has(u.parentId)) {
        // Tenta promover para o avô (parent do parent), se existir.
        let candidate = null;
        const removedParent = units.find(x => x.id === u.parentId);
        if (removedParent && removedParent.parentId && byIdLocal.has(removedParent.parentId)) {
          candidate = removedParent.parentId;
        }
        if (candidate) {
          u.parentId = candidate;
          changed = true;
        } else {
          units.splice(i, 1);
          changed = true;
        }
      }
    }
  }

  // Reordena por sortOrder e define articleCount.
  const sortedUnits = [...units].sort((a, b) => a.sortOrder - b.sortOrder);
  const articleCount = sortedUnits.filter(u => u.kind === 'artigo').length;
  assert(articleCount > 0, `${normId}: no articles extracted`);

  // Acrescenta heading textual aos containers sem heading.
  for (const u of sortedUnits) {
    if (['parte','livro','titulo','capitulo','secao','subsecao'].includes(u.kind) && !u.heading && u.text) {
      u.heading = u.text;
      u.text = '';
    }
  }

  // Valida: primeiro e último unit (em ordem de sortOrder) usados pelo acquisition.
  const firstUnit = sortedUnits[0];
  const lastUnit = sortedUnits[sortedUnits.length - 1];

  // URN canônica quando não fornecida.
  const urn = config.urn || `urn:lex:br:federal:lei:${config.publicationDate};${config.number || config.year}`;

  const norm = {
    id: normId,
    urn,
    type: 'lei',
    number: String(config.number || ''),
    year: config.year,
    title: config.title,
    popularName: config.popularName || config.title,
    aliases: config.aliases,
    ementa: config.ementa,
    status: 'vigente',
    publicationDate: config.publicationDate,
    versionDate: config.versionDate,
    officialSourceUrl: config.sourceUrl,
    sourceFile: config.sourceFile,
    sourceHash,
    lastVerifiedAt: verifiedAt,
    acquisition: {
      normId,
      sourceFile: config.sourceFile,
      sourceHash,
      unitCount: sortedUnits.length,
      articleCount,
      firstCanonicalPath: firstUnit.canonicalPath,
      lastCanonicalPath: lastUnit.canonicalPath,
      verifiedAt,
      complete: true,
    },
    units: sortedUnits,
  };

  const validated = validateNorm(norm);
  const outFile = `legal/corpus/${normId}.json`;
  await fs.mkdir(path.dirname(path.resolve(process.cwd(), outFile)), { recursive: true });
  await fs.writeFile(path.resolve(process.cwd(), outFile), `${JSON.stringify(validated, null, 2)}\n`);

  console.log(`[import-planalto-codigo] ${normId}: wrote ${outFile}`);
  console.log(`  units=${sortedUnits.length} articles=${articleCount} first=${firstUnit.canonicalPath} last=${lastUnit.canonicalPath}`);
  console.log(`  sourceHash=${sourceHash}`);
  return validated;
}
