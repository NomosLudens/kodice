/**
 * Frontend catalog resolver (vanilla JS). Espelha scripts/legal-catalog-lib.mjs.
 * SEM LLM, sem fuzzy matching. Apenas normalização + aliases + regex.
 */

function normalizeQueryCatalog(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[º°ª]/g, '');
  s = s.replace(/\bart\.?(?=\s|$)/g, 'art');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function extractNormCandidateCatalog(normalized) {
  if (!normalized) return null;
  const digitsMatch = normalized.match(/^(\d{4,6})$/);
  if (digitsMatch) return { kind: 'onlyDigits', value: digitsMatch[1] };
  const shortMatch = normalized.match(/^([a-z0-9/.-]*[a-z][a-z0-9/.-]*)$/);
  if (shortMatch && shortMatch[1].length <= 30) return { kind: 'aliasShort', value: shortMatch[1] };
  const leiNumMatch = normalized.match(/^(?:lei|decreto[\s-]?lei|dl)\.?\s*(\d{1,5}(?:[.\-]?\d{1,5})?)$/);
  if (leiNumMatch) return { kind: 'leiNum', value: leiNumMatch[1] };
  if (normalized.includes(' ')) return { kind: 'phrase', value: normalized };
  return null;
}

function matchesAliasCatalog(normEntry, candidate) {
  if (!normEntry || !normEntry.aliases || !candidate) return false;
  if (candidate.kind === 'aliasShort' || candidate.kind === 'phrase') {
    return normEntry.aliases.some(a => normalizeQueryCatalog(a) === candidate.value);
  }
  if (candidate.kind === 'leiNum' || candidate.kind === 'onlyDigits') {
    const digits = String(candidate.value).replace(/\D/g, '');
    return normEntry.aliases.some(a => {
      const aN = normalizeQueryCatalog(a);
      const m = aN.match(/^(?:lei|decreto[\s-]?lei|dl)[\s-]*(\d{1,5}(?:[.\-]?\d{1,5})?)$/);
      return m ? m[1].replace(/\D/g, '') === digits : false;
    });
  }
  return false;
}

function resolveCatalogFrontend(rawQuery, catalog) {
  const normalized = normalizeQueryCatalog(rawQuery);
  if (!normalized) return { match: null, article: null };
  if (!catalog || !Array.isArray(catalog.norms)) return { match: null, article: null };

  const headNorm = normalized.match(/^(.+?)\s+art(?:igo|\.)?\s*(\d+(?:[\.\-]\d+)*)\s*$/);
  if (headNorm) {
    const c = extractNormCandidateCatalog(headNorm[1]);
    if (c) {
      const n = catalog.norms.find(x => matchesAliasCatalog(x, c));
      if (n) return { match: n, article: headNorm[2] };
    }
  }
  const tailNorm = normalized.match(/^art(?:igo|\.)?\s*(\d+(?:[\.\-]\d+)*)\s+(.+)$/);
  if (tailNorm) {
    const c = extractNormCandidateCatalog(tailNorm[2]);
    if (c) {
      const n = catalog.norms.find(x => matchesAliasCatalog(x, c));
      if (n) return { match: n, article: tailNorm[1] };
    }
  }
  const bareHead = normalized.match(/^(\S+)\s+(\d+(?:[\.\-]\d+)*)$/);
  if (bareHead) {
    const c = extractNormCandidateCatalog(bareHead[1]);
    if (c && c.kind === 'aliasShort') {
      const n = catalog.norms.find(x => matchesAliasCatalog(x, c));
      if (n) return { match: n, article: bareHead[2] };
    }
  }
  const c = extractNormCandidateCatalog(normalized);
  if (c) {
    const n = catalog.norms.find(x => matchesAliasCatalog(x, c));
    if (n) return { match: n, article: null };
  }
  return { match: null, article: null };
}

window.normalizeQueryCatalog = normalizeQueryCatalog;
window.resolveCatalogFrontend = resolveCatalogFrontend;
