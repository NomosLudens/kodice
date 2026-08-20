import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sha256Bytes, validateNorm } from './legal-corpus-lib.mjs';

/**
 * Importador determinístico da Lei 7.347/1985 (Ação Civil Pública) a
 * partir do snapshot oficial da Câmara dos Deputados (texto atualizado).
 *
 * Esta onda aproveita o mesmo padrão HTML da Câmara "texto-atualizado-pl"
 * já usado pelo CPC/2015 (`import-cpc2015.mjs`) mas com a estrutura
 * específica da L7347: a lei é plana (sem PARTE/LIVRO/TÍTULO/CAPÍTULO),
 * apenas Art./§/Inciso/Alínea.
 *
 * A Câmara-texto-atualizada é uma estrutura reconhecida — não há
 * necessidade de generalizar import-cpc2015.mjs (que tem PARTE/LIVRO/
 * TÍTULO para o CPC). O ACP usa a menor adaptação do mesmo padrão.
 */
export async function parseAcp1985(sourceFile = 'legal/sources/acp1985/lei7347-24julho1985-normaatualizada.htm', root = process.cwd()) {
  const absoluteSource = path.resolve(root, sourceFile);
  const buffer = await fs.readFile(absoluteSource);
  const sourceHash = sha256Bytes(buffer);
  const html = buffer.toString('utf8');

  const pMatches = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const paras = pMatches
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Preambulo: "O PRESIDENTE DA REPÚBLICA" + "Faço saber" + "decreta" — mesmo
  // padrão que o CPC. Casa tanto para L7347 quanto para qualquer outra
  // lei sancionada via Congresso Nacional.
  const preambleIdx = paras.findIndex(p =>
    /PRESIDENTE DA REP[ÚU]BLICA/i.test(p) ||
    /Faço saber/i.test(p) ||
    /decreta:/i.test(p)
  );
  if (preambleIdx === -1) {
    throw new Error('Não foi possível localizar o preâmbulo no snapshot da L7347');
  }

  const units = [];
  let sortOrder = 1;

  units.push({
    id: 'acp1985-preambulo',
    parentId: null,
    kind: 'preambulo',
    label: 'PREÂMBULO',
    canonicalPath: 'preambulo',
    heading: null,
    text: paras[preambleIdx],
    sortOrder: sortOrder++,
    status: 'vigente',
  });

  // L7347 é uma lei plana: sem PARTE/LIVRO/TÍTULO/CAPÍTULO/SEÇÃO. Apenas
  // Art./§/Inciso/Alínea/Item. Estado de stack: apenas currentArtigo,
  // currentParagrafo, currentInciso, currentAlinea.
  let currentArtigo = null;
  let currentParagrafo = null;
  let currentInciso = null;
  let currentAlinea = null;

  let i = preambleIdx + 1;
  while (i < paras.length) {
    const p = paras[i];

    // Fim do documento: assinaturas, datas, "Brasília,", "Disciplina a ação...".
    if (/^Brasília,\s*\d/i.test(p) ||
        /^Disciplina a ação civil/i.test(p) ||
        /^O PRESIDENTE DA REP[ÚU]BLICA/i.test(p) ||
        /^Faço saber/i.test(p) ||
        /^LEI\s+N[ºo°]/i.test(p) ||
        /^CÂMARA DOS DEPUTADOS/i.test(p)) {
      i++;
      continue;
    }

    // Artigo
    let m = p.match(/^Art\.\s*(\d+(?:-[A-Za-z]+)?)[ºo°ª.]?\s*(.*)/);
    if (m) {
      const artNum = m[1].toLowerCase();
      const canonicalPath = 'art' + artNum;
      const id = 'acp1985-' + canonicalPath;
      currentArtigo = id;
      currentParagrafo = null; currentInciso = null; currentAlinea = null;
      units.push({
        id, parentId: null, kind: 'artigo',
        label: 'ART' + m[1].toUpperCase(), canonicalPath,
        heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
      });
      i++;
      continue;
    }

    // Parágrafo
    m = p.match(/^§\s*(\d+)[ºo°ª.]?\s*(.*)/);
    if (m) {
      const parNum = m[1];
      if (currentArtigo) {
        const parentCp = currentArtigo.replace('acp1985-', '');
        const canonicalPath = parentCp + '-par' + parNum;
        const id = 'acp1985-' + canonicalPath;
        currentParagrafo = id;
        currentInciso = null; currentAlinea = null;
        units.push({
          id, parentId: currentArtigo, kind: 'paragrafo',
          label: 'PAR' + parNum, canonicalPath,
          heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
        });
      }
      i++;
      continue;
    }
    m = p.match(/^Par[áa]grafo\s+[úu]nico\.?\s*(.*)/i);
    if (m) {
      if (currentArtigo) {
        const parentCp = currentArtigo.replace('acp1985-', '');
        const canonicalPath = parentCp + '-parunico';
        const id = 'acp1985-' + canonicalPath;
        currentParagrafo = id;
        currentInciso = null; currentAlinea = null;
        units.push({
          id, parentId: currentArtigo, kind: 'paragrafo',
          label: 'PARUNICO', canonicalPath,
          heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
        });
      }
      i++;
      continue;
    }

    // Inciso
    m = p.match(/^([IVXLCDM]+)\s*[-–]\s*(.*)/);
    if (m && currentArtigo) {
      const incNum = m[1].toLowerCase();
      const parent = currentParagrafo || currentArtigo;
      const parentCp = parent.replace('acp1985-', '');
      const canonicalPath = parentCp + '-inc' + incNum;
      const id = 'acp1985-' + canonicalPath;
      currentInciso = id;
      currentAlinea = null;
      units.push({
        id, parentId: parent, kind: 'inciso',
        label: 'INC' + m[1].toUpperCase(), canonicalPath,
        heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
      });
      i++;
      continue;
    }

    // Alínea (a), b)...)
    m = p.match(/^([a-z])\)\s*(.*)/);
    if (m && (currentInciso || currentParagrafo)) {
      const alNum = m[1];
      const parent = currentInciso || currentParagrafo;
      const parentCp = parent.replace('acp1985-', '');
      const baseCp = parentCp + '-ali' + alNum;
      let canonicalPath = baseCp;
      let id = 'acp1985-' + canonicalPath;
      let suffix = 0;
      while (units.some(u => u.canonicalPath === canonicalPath)) {
        suffix += 1;
        canonicalPath = `${baseCp}-${suffix}`;
        id = 'acp1985-' + canonicalPath;
      }
      currentAlinea = id;
      units.push({
        id, parentId: parent, kind: 'alinea',
        label: 'ALI' + alNum.toUpperCase() + (suffix ? `-${suffix}` : ''),
        canonicalPath, heading: null, text: p, sortOrder: sortOrder++, status: 'vigente',
      });
      i++;
      continue;
    }

    // Continuação de texto vinculada à última unidade textual.
    if (units.length > 0) {
      const lastUnit = units[units.length - 1];
      if (lastUnit.text) lastUnit.text += ' ' + p;
      else lastUnit.text = p;
    }

    i++;
  }

  const sortedUnits = [...units].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const articleCount = sortedUnits.filter(u => u.kind === 'artigo').length;
  assert(articleCount > 0, `acp1985: no articles extracted`);

  const norm = {
    id: 'acp1985',
    urn: 'urn:lex:br:federal:lei:1985-07-24;7347',
    type: 'lei',
    number: '7347',
    year: 1985,
    title: 'Lei da Ação Civil Pública',
    popularName: 'ACP',
    aliases: ['ACP', 'acp', 'Ação Civil Pública', 'Lei 7347', 'Lei 7.347', 'Lei da Ação Civil Pública'],
    ementa: 'Disciplina a ação civil pública de responsabilidade por danos causados ao meio ambiente, ao consumidor, a bens e direitos de valor artístico, estético, histórico, turístico e paisagístico, ou a qualquer outro interesse difuso ou coletivo.',
    status: 'vigente',
    publicationDate: '1985-07-25',
    versionDate: '1985-07-24',
    officialSourceUrl: 'https://www2.camara.leg.br/legin/fed/lei/1980-1987/lei-7347-24-julho-1985-356939-normaatualizada-pl.html',
    sourceFile: 'legal/sources/acp1985/lei7347-24julho1985-normaatualizada.htm',
    sourceHash,
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    acquisition: {
      normId: 'acp1985',
      sourceFile: 'legal/sources/acp1985/lei7347-24julho1985-normaatualizada.htm',
      sourceHash,
      unitCount: sortedUnits.length,
      articleCount,
      firstCanonicalPath: sortedUnits[0].canonicalPath,
      lastCanonicalPath: sortedUnits[sortedUnits.length - 1].canonicalPath,
      verifiedAt: new Date().toISOString().slice(0, 10),
      complete: true,
    },
    units: sortedUnits,
  };

  return validateNorm(norm);
}

function assert(cond, msg) { if (!cond) throw new Error(`import-acp1985: ${msg}`); }

if (process.argv[1] && process.argv[1].endsWith('import-acp1985.mjs')) {
  try {
    const norm = await parseAcp1985();
    const targetFile = 'legal/corpus/acp1985.json';
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, `${JSON.stringify(norm, null, 2)}\n`);
    console.log(`Imported ACP/1985 to ${targetFile}: ${norm.units.length} units (${norm.acquisition.articleCount} articles).`);
  } catch (error) {
    console.error('Falha na importação da L7347:', error?.message || error);
    process.exitCode = 1;
  }
}
