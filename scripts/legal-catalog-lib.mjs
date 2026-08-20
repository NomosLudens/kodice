import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * legal-catalog-lib.mjs
 *
 * Resolução determinística de referências jurídicas estruturais (CF, CPC,
 * "art 5 cf", "300 cpc") para o catálogo de normas do Kódice.
 *
 * Sem fuzzy matching pesado. Sem LLM. Sem embeddings. Apenas:
 *   - normalização de casing/acentos/pontuação/espaços/hífens
 *   - aliases explícitos por norma
 *   - regex determinísticas para padrões do tipo "art N <norma>"
 */

const NORM = '[A-Za-z][A-Za-z0-9./-]*';

/**
 * Normaliza uma consulta para casar com aliases do catálogo.
 * - lower case
 * - remove acentos
 * - colapsa múltiplos espaços
 * - remove ".", "º", "°", "ª" e converte "art." → "art"
 * - mantém pontos em números (Lei 10.406) e hífens
 */
export function normalizeQuery(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[º°ª]/g, '');
  s = s.replace(/\bart\.?(?=\s|$)/g, 'art'); // "art." ou "art" → "art"
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Extrai candidatos a identificador de norma a partir do texto
 * normalizado. Ordem de prioridade:
 *  1) alias exato (curto ou multi-palavra): cf, cpc, cf88, cpc2015,
 *     constituicao federal, codigo de processo civil, lei 13.105
 *  2) sigla com sufixo numérico (cf88, cpc2015, cc2002) → "aliasShort"
 *  3) número de lei isolado (13105, 3689) → "leiNumDigits"
 */
export function extractNormCandidate(normalized) {
  if (!normalized) return null;

  // Só dígitos (ex: "13105", "3689", "8078") — ANTES de aliasShort para
  // que 4-6 dígitos sejam interpretados como número de lei, não como sigla.
  const digitsMatch = normalized.match(/^(\d{4,6})$/);
  if (digitsMatch) {
    return { kind: 'onlyDigits', value: digitsMatch[1] };
  }

  // Sigla (2-30 chars, deve conter pelo menos uma letra) — cf, cpc,
  // cf88, cpc2015, constituicao, cpc/2015
  const shortMatch = normalized.match(/^([a-z0-9/.-]*[a-z][a-z0-9/.-]*)$/);
  if (shortMatch && shortMatch[1].length <= 30) {
    return { kind: 'aliasShort', value: shortMatch[1] };
  }

  // Lei/decreto-lei/DL + número (com ou sem pontos/hífens)
  const leiNumMatch = normalized.match(/^(?:lei|decreto[\s-]?lei|dl)\.?\s*(\d{1,5}(?:[.\-]?\d{1,5})?)$/);
  if (leiNumMatch) {
    return { kind: 'leiNum', value: leiNumMatch[1] };
  }

  // Match exato em alias multi-palavra
  if (normalized.includes(' ')) {
    return { kind: 'phrase', value: normalized };
  }

  return null;
}

/**
 * Compara um valor candidato contra os aliases de uma norma,
 * ambos normalizados. Match exato ou por padrão de número de lei.
 */
function matchesAlias(normEntry, candidate) {
  if (!normEntry?.aliases || !candidate) return false;
  if (candidate.kind === 'aliasShort' || candidate.kind === 'phrase') {
    return normEntry.aliases.some(a => normalizeQuery(a) === candidate.value);
  }
  if (candidate.kind === 'leiNum' || candidate.kind === 'onlyDigits') {
    const digits = String(candidate.value).replace(/\D/g, '');
    return normEntry.aliases.some(a => {
      const aN = normalizeQuery(a);
      // Match "lei <num>" ou "lei-<num>" no alias
      const leiMatch = aN.match(/^(?:lei|decreto[\s-]?lei|dl)[\s-]*(\d{1,5}(?:[.\-]?\d{1,5})?)$/);
      if (leiMatch) {
        return leiMatch[1].replace(/\D/g, '') === digits;
      }
      return false;
    });
  }
  return false;
}

/**
 * Resolve uma string bruta para uma entrada do catálogo. Pode retornar
 * { match, article } se a consulta tiver padrão "<norma> art N" ou
 * "<art> <norma>". Retorna { match } se for só a norma. Retorna null
 * se nenhuma referência reconhecida.
 */
export function resolveCatalog(rawQuery, catalog) {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) return { match: null, article: null };

  // Padrão "<norma> art N" (norma no início)
  // ex: "cf art 5", "cpc art 300", "cp art 155"
  const headNorm = normalized.match(/^(.+?)\s+art(?:igo|\.)?\s*(\d+(?:[\.\-]\d+)*)\s*$/);
  if (headNorm) {
    const candidate = extractNormCandidate(headNorm[1]);
    if (candidate) {
      const norm = catalog.norms.find(n => matchesAlias(n, candidate));
      if (norm) return { match: norm, article: headNorm[2] };
    }
  }

  // Padrão "art N <norma>" (norma no fim)
  // ex: "art 5 cf", "art 300 cpc", "art 5 constituicao"
  const tailNorm = normalized.match(/^art(?:igo|\.)?\s*(\d+(?:[\.\-]\d+)*)\s+(.+)$/);
  if (tailNorm) {
    const candidate = extractNormCandidate(tailNorm[2]);
    if (candidate) {
      const norm = catalog.norms.find(n => matchesAlias(n, candidate));
      if (norm) return { match: norm, article: tailNorm[1] };
    }
  }

  // Padrão "<norma> N" sem "art" — "cpc 300" → CPC Art. 300, "cf 5" → CF Art. 5
  // Só dispara quando a parte da norma for uma sigla/alias conhecido
  const bareHead = normalized.match(/^(\S+)\s+(\d+(?:[\.\-]\d+)*)$/);
  if (bareHead) {
    const candidate = extractNormCandidate(bareHead[1]);
    if (candidate && candidate.kind === 'aliasShort') {
      const norm = catalog.norms.find(n => matchesAlias(n, candidate));
      if (norm) return { match: norm, article: bareHead[2] };
    }
  }

  // Padrão "<numero> <alias>" puro (ex: "300 cpc", "5 cf")
  const numFirst = normalized.match(/^(\d+(?:[\.\-]\d+)*)\s+(.+)$/);
  if (numFirst) {
    const candidate = extractNormCandidate(numFirst[2]);
    if (candidate) {
      const norm = catalog.norms.find(n => matchesAlias(n, candidate));
      if (norm) return { match: norm, article: numFirst[1] };
    }
  }

  // Padrão só de norma (sem número de artigo)
  const candidate = extractNormCandidate(normalized);
  if (candidate) {
    const norm = catalog.norms.find(n => matchesAlias(n, candidate));
    if (norm) return { match: norm, article: null };
  }

  return { match: null, article: null };
}

export async function loadCatalog(file = 'legal/catalog.json', options = {}) {
  const root = options.root || process.cwd();
  const raw = await fs.readFile(path.resolve(root, file), 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.norms)) {
    throw new Error(`${file}: invalid catalog format`);
  }
  return parsed;
}
