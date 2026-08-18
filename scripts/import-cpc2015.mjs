import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sha256Bytes, validateNorm } from './legal-corpus-lib.mjs';

/**
 * Importador determinístico do Código de Processo Civil de 2015 (Lei nº 13.105/2015)
 * a partir do snapshot oficial da Câmara dos Deputados (texto atualizado).
 */
export async function parseCpc2015(sourceFile = 'legal/sources/cpc2015/lei-13105-16-marco-2015-normaatualizada-pl.html', root = process.cwd()) {
  const absoluteSource = path.resolve(root, sourceFile);
  const buffer = await fs.readFile(absoluteSource);
  const sourceHash = sha256Bytes(buffer);
  const html = buffer.toString('utf8');

  const pMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paras = pMatches
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const preambleIdx = paras.findIndex(p => /^Faço saber/i.test(p));
  if (preambleIdx === -1) {
    throw new Error('Não foi possível localizar o preâmbulo no snapshot do CPC/2015');
  }

  const units = [];
  let sortOrder = 1;

  units.push({
    id: 'cpc2015-preambulo',
    parentId: null,
    kind: 'preambulo',
    label: 'PREÂMBULO',
    canonicalPath: 'preambulo',
    heading: null,
    text: paras[preambleIdx],
    sortOrder: sortOrder++,
    status: 'vigente'
  });

  let currentParte = null;
  let currentLivro = null;
  let currentTitulo = null;
  let currentCapitulo = null;
  let currentSecao = null;
  let currentSubsecao = null;
  let currentArtigo = null;
  let currentParagrafo = null;
  let currentInciso = null;
  let currentAlinea = null;

  let i = preambleIdx + 1;
  while (i < paras.length) {
    const p = paras[i];
    if (/^DILMA ROUSSEFF/i.test(p) || /^Brasília,\s*\d+/i.test(p)) {
      break;
    }

    // Parte
    let m = p.match(/^PARTE\s+(GERAL|ESPECIAL)/i);
    if (m) {
      const parteSlug = m[1].toLowerCase();
      const canonicalPath = 'parte-' + parteSlug;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentParte = id;
      currentLivro = null; currentTitulo = null; currentCapitulo = null; currentSecao = null; currentSubsecao = null;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: null, kind: 'parte', label: 'PARTE ' + m[1].toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Livro
    m = p.match(/^LIVRO\s+([IVXLCDM]+|COMPLEMENTAR)/i);
    if (m) {
      const livroSlug = m[1].toLowerCase();
      const prefix = currentParte ? currentParte.replace('cpc2015-', '') + '-' : '';
      const canonicalPath = prefix + 'livro-' + livroSlug;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentLivro = id;
      currentTitulo = null; currentCapitulo = null; currentSecao = null; currentSubsecao = null;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: currentParte, kind: 'livro', label: 'LIVRO ' + m[1].toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Titulo
    m = p.match(/^T[ÍI]TULO\s+([IVXLCDM]+|ÚNICO|UNICO)/i);
    if (m) {
      const titSlug = m[1].toLowerCase().replace('ú', 'u');
      const prefix = currentLivro ? currentLivro.replace('cpc2015-', '') + '-' : (currentParte ? currentParte.replace('cpc2015-', '') + '-' : '');
      const canonicalPath = prefix + 'tit-' + titSlug;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentTitulo = id;
      currentCapitulo = null; currentSecao = null; currentSubsecao = null;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: currentLivro || currentParte, kind: 'titulo', label: 'TÍTULO ' + m[1].toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Capitulo
    m = p.match(/^CAP[ÍI]TULO\s+([IVXLCDM]+|ÚNICO|UNICO)/i);
    if (m) {
      const capSlug = m[1].toLowerCase().replace('ú', 'u');
      const prefix = currentTitulo ? currentTitulo.replace('cpc2015-', '') + '-' : (currentLivro ? currentLivro.replace('cpc2015-', '') + '-' : '');
      const canonicalPath = prefix + 'cap-' + capSlug;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentCapitulo = id;
      currentSecao = null; currentSubsecao = null;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: currentTitulo || currentLivro || currentParte, kind: 'capitulo', label: 'CAPÍTULO ' + m[1].toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Secao
    m = p.match(/^Seção\s+([IVXLCDM]+|ÚNICA|UNICA)|^SEÇÃO\s+([IVXLCDM]+|ÚNICA|UNICA)/i);
    if (m) {
      const secNum = (m[1] || m[2]).toLowerCase().replace('ú', 'u');
      const prefix = currentCapitulo ? currentCapitulo.replace('cpc2015-', '') + '-' : '';
      const canonicalPath = prefix + 'sec-' + secNum;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentSecao = id;
      currentSubsecao = null;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: currentCapitulo || currentTitulo, kind: 'secao', label: 'SEÇÃO ' + (m[1] || m[2]).toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Subsecao
    m = p.match(/^Subseção\s+([IVXLCDM]+|ÚNICA|UNICA)|^SUBSEÇÃO\s+([IVXLCDM]+|ÚNICA|UNICA)/i);
    if (m) {
      const subNum = (m[1] || m[2]).toLowerCase().replace('ú', 'u');
      const prefix = currentSecao ? currentSecao.replace('cpc2015-', '') + '-' : '';
      const canonicalPath = prefix + 'subsec-' + subNum;
      const id = 'cpc2015-' + canonicalPath;
      let heading = null;
      if (i + 1 < paras.length && !/^(PARTE|LIVRO|TÍTULO|TITULO|CAPÍTULO|CAPITULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO|Art\.)/i.test(paras[i + 1])) {
        heading = paras[++i];
      }
      currentSubsecao = id;
      currentArtigo = null; currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: currentSecao || currentCapitulo, kind: 'subsecao', label: 'SUBSEÇÃO ' + (m[1] || m[2]).toUpperCase(), canonicalPath, heading, text: '', sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Artigo
    m = p.match(/^Art\.\s*([\d\.]+(?:-[A-Za-z]+)?)[ºo\.]?\s*(.*)/i);
    if (m) {
      const artNum = m[1].replace(/\./g, '').toLowerCase();
      const canonicalPath = 'art' + artNum;
      const id = 'cpc2015-' + canonicalPath;
      const parentId = currentSubsecao || currentSecao || currentCapitulo || currentTitulo || currentLivro || currentParte;
      currentArtigo = id;
      currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({ id, parentId, kind: 'artigo', label: 'ART' + artNum.toUpperCase(), canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Paragrafo
    m = p.match(/^(?:§\s*([\d\.]+[ºo]?(?:-[A-Za-z]+)?)|(Parágrafo\s+único|Paragrafo\s+unico))\b\.?\s*(.*)/i);
    if (m) {
      let parNum = '1';
      if (m[2]) parNum = 'unico';
      else parNum = m[1].replace(/[\.ºo]/g, '').toLowerCase();
      const parent = currentArtigo;
      const canonicalPath = parent.replace('cpc2015-', '') + '-par' + parNum;
      const id = 'cpc2015-' + canonicalPath;
      currentParagrafo = id;
      currentInciso = null; currentAlinea = null;
      units.push({ id, parentId: parent, kind: 'paragrafo', label: 'PAR' + parNum.toUpperCase(), canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Inciso
    m = p.match(/^([IVXLCDM]+(?:-[A-Za-z]+)?|[0-9]+)\s*[-–—]\s*(.*)/i);
    if (m) {
      const incNum = m[1].toLowerCase();
      const parent = currentParagrafo || currentArtigo;
      const canonicalPath = parent.replace('cpc2015-', '') + '-inc' + incNum;
      const id = 'cpc2015-' + canonicalPath;
      currentInciso = id;
      currentAlinea = null;
      units.push({ id, parentId: parent, kind: 'inciso', label: 'INC' + incNum.toUpperCase(), canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Alinea
    m = p.match(/^([a-z](?:-[A-Za-z]+)?)\)\s*(.*)/i);
    if (m) {
      const alNum = m[1].toLowerCase();
      const parent = currentInciso || currentParagrafo || currentArtigo;
      const canonicalPath = parent.replace('cpc2015-', '') + '-ali' + alNum;
      const id = 'cpc2015-' + canonicalPath;
      currentAlinea = id;
      units.push({ id, parentId: parent, kind: 'alinea', label: 'ALI' + alNum.toUpperCase(), canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Item
    m = p.match(/^(\d+(?:-[A-Za-z]+)?)\.\s+(.*)/i);
    if (m && currentAlinea) {
      const itNum = m[1].toLowerCase();
      const parent = currentAlinea;
      const canonicalPath = parent.replace('cpc2015-', '') + '-item' + itNum;
      const id = 'cpc2015-' + canonicalPath;
      units.push({ id, parentId: parent, kind: 'item', label: 'ITEM' + itNum.toUpperCase(), canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente' });
      i++;
      continue;
    }

    // Continuação de texto vinculada à última unidade textual
    if (units.length > 0) {
      const lastUnit = units[units.length - 1];
      if (lastUnit.text) lastUnit.text += ' ' + p;
      else lastUnit.text = p;
    }

    i++;
  }

  const sortedUnits = [...units].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const articleCount = sortedUnits.filter(u => u.kind === 'artigo').length;

  const norm = {
    id: 'cpc2015',
    urn: 'urn:lex:br:federal:lei:2015-03-16;13105',
    type: 'lei',
    number: '13105',
    year: 2015,
    title: 'Código de Processo Civil de 2015',
    popularName: 'CPC/2015',
    aliases: ['cpc2015', 'cpc', 'lei-13105', 'processo-civil'],
    ementa: 'Código de Processo Civil.',
    status: 'vigente',
    publicationDate: '2015-03-17',
    versionDate: '2015-03-16',
    officialSourceUrl: 'https://www.camara.leg.br/legin/fed/lei/2015/lei-13105-16-marco-2015-780273-normaatualizada-pl.html',
    sourceFile: 'legal/sources/cpc2015/lei-13105-16-marco-2015-normaatualizada-pl.html',
    sourceHash,
    lastVerifiedAt: '2026-08-18T00:00:00.000Z',
    acquisition: {
      normId: 'cpc2015',
      sourceFile: 'legal/sources/cpc2015/lei-13105-16-marco-2015-normaatualizada-pl.html',
      sourceHash,
      unitCount: sortedUnits.length,
      articleCount,
      firstCanonicalPath: sortedUnits[0].canonicalPath,
      lastCanonicalPath: sortedUnits[sortedUnits.length - 1].canonicalPath,
      verifiedAt: '2026-08-18T00:00:00.000Z',
      complete: true
    },
    units: sortedUnits
  };

  return validateNorm(norm);
}

if (process.argv[1] && process.argv[1].endsWith('import-cpc2015.mjs')) {
  try {
    const norm = await parseCpc2015();
    const targetFile = 'legal/corpus/cpc2015.json';
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, `${JSON.stringify(norm, null, 2)}\n`);
    console.log(`Imported CPC/2015 to ${targetFile}: ${norm.units.length} units (${norm.acquisition.articleCount} articles).`);
  } catch (error) {
    console.error('Falha na importação do CPC/2015:', error?.message || error);
    process.exitCode = 1;
  }
}
