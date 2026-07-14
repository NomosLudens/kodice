import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const REQUIRED_NORMS = new Set(['cf88', 'cpc2015']);
export const TEXTUAL_KINDS = new Set(['preambulo','artigo','paragrafo','inciso','alinea','item','disposicao_transitoria']);
export const ALLOWED_KINDS = new Set(['preambulo','parte','livro','titulo','capitulo','secao','subsecao','artigo','paragrafo','inciso','alinea','item','disposicao_transitoria']);
export const OFFICIAL_SOURCE_HOSTS = new Set([
  'normas.leg.br',
  'www.normas.leg.br',
  'camara.leg.br',
  'www.camara.leg.br',
  'senado.leg.br',
  'www.senado.leg.br',
  'www25.senado.leg.br',
  'planalto.gov.br',
  'www.planalto.gov.br',
  'lexml.gov.br',
  'www.lexml.gov.br'
]);

export function stableStringify(value){
  if(Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if(value && typeof value === 'object'){
    return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value){ return createHash('sha256').update(value).digest('hex'); }
export function sha256Bytes(value){ return createHash('sha256').update(value).digest('hex'); }

function assert(cond, msg){ if(!cond) throw new Error(msg); }
function nonEmptyString(value){ return typeof value === 'string' && value.trim().length > 0; }
function validDateString(value){ return nonEmptyString(value) && !Number.isNaN(Date.parse(value)); }

export function parseOfficialUrl(value, normId='norm'){
  assert(nonEmptyString(value), `${normId}: officialSourceUrl must be a non-empty string`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${normId}: officialSourceUrl must be a valid URL`); }
  assert(url.protocol === 'https:', `${normId}: officialSourceUrl must be https`);
  assert(OFFICIAL_SOURCE_HOSTS.has(url.hostname.toLowerCase()), `${normId}: officialSourceUrl host is not an accepted official source`);
  return url;
}

export function resolveSourceFile(sourceFile, root=process.cwd()){
  assert(nonEmptyString(sourceFile), 'sourceFile must be a non-empty string');
  assert(!path.isAbsolute(sourceFile), `${sourceFile}: sourceFile must be relative`);
  assert(!sourceFile.split(/[\\/]+/).includes('..'), `${sourceFile}: sourceFile must not contain ..`);
  const normalized = path.posix.normalize(sourceFile.replace(/\\/g, '/'));
  assert(normalized.startsWith('legal/sources/'), `${sourceFile}: sourceFile must stay inside legal/sources`);
  const absolute = path.resolve(root, normalized);
  const sourcesRoot = path.resolve(root, 'legal/sources');
  assert(absolute === sourcesRoot || absolute.startsWith(`${sourcesRoot}${path.sep}`), `${sourceFile}: sourceFile escapes legal/sources`);
  return { normalized, absolute };
}

export async function verifySourceHash(norm, root=process.cwd()){
  const { absolute } = resolveSourceFile(norm.sourceFile, root);
  let bytes;
  try {
    const sourcesReal = await fs.realpath(path.resolve(root, 'legal/sources'));
    const sourceReal = await fs.realpath(absolute);
    if(sourceReal !== sourcesReal && !sourceReal.startsWith(`${sourcesReal}${path.sep}`)){
      throw new Error(`${norm.id}: sourceFile resolves outside legal/sources`);
    }
    bytes = await fs.readFile(sourceReal);
  } catch (error) {
    if(error?.code === 'ENOENT') throw new Error(`${norm.id}: ARQUIVO OFICIAL DE ORIGEM AUSENTE: ${norm.sourceFile}`);
    throw error;
  }
  const actual = sha256Bytes(bytes);
  assert(actual === norm.sourceHash, `${norm.id}: sourceHash mismatch for ${norm.sourceFile}`);
  return actual;
}

export function validateNormShape(norm){
  assert(norm && typeof norm === 'object' && !Array.isArray(norm), 'norm must be an object');
  for(const field of ['id','urn','type','year','title','popularName','aliases','ementa','status','publicationDate','versionDate','officialSourceUrl','sourceFile','sourceHash','lastVerifiedAt','acquisition','units']){
    assert(Object.hasOwn(norm, field), `${norm?.id || 'norm'}: missing ${field}`);
  }
  assert(nonEmptyString(norm.id) && /^[a-z][a-z0-9-]*$/.test(norm.id), `${norm.id}: invalid norm id`);
  assert(nonEmptyString(norm.urn), `${norm.id}: urn must be a non-empty string`);
  assert(nonEmptyString(norm.type), `${norm.id}: type must be a non-empty string`);
  assert(Number.isInteger(norm.year) && norm.year > 0, `${norm.id}: year must be a positive integer`);
  assert(nonEmptyString(norm.title), `${norm.id}: title must be a non-empty string`);
  assert(nonEmptyString(norm.popularName), `${norm.id}: popularName must be a non-empty string`);
  assert(Array.isArray(norm.aliases) && norm.aliases.length > 0 && norm.aliases.every(nonEmptyString), `${norm.id}: aliases must be non-empty strings`);
  assert(nonEmptyString(norm.ementa), `${norm.id}: ementa must be a non-empty string`);
  assert(nonEmptyString(norm.status), `${norm.id}: status must be a non-empty string`);
  assert(validDateString(norm.publicationDate), `${norm.id}: invalid publicationDate`);
  assert(validDateString(norm.versionDate), `${norm.id}: invalid versionDate`);
  assert(validDateString(norm.lastVerifiedAt), `${norm.id}: invalid lastVerifiedAt`);
  parseOfficialUrl(norm.officialSourceUrl, norm.id);
  resolveSourceFile(norm.sourceFile);
  assert(/^[a-f0-9]{64}$/.test(norm.sourceHash), `${norm.id}: sourceHash must be sha256 hex`);
  assert(Array.isArray(norm.units), `${norm.id}: units must be array`);
  validateAcquisition(norm);
  return norm;
}

export function validateAcquisition(norm){
  const a = norm.acquisition;
  assert(a && typeof a === 'object' && !Array.isArray(a), `${norm.id}: acquisition must be an object`);
  for(const field of ['normId','sourceFile','sourceHash','unitCount','articleCount','firstCanonicalPath','lastCanonicalPath','verifiedAt','complete']) assert(Object.hasOwn(a, field), `${norm.id}: acquisition missing ${field}`);
  assert(a.normId === norm.id, `${norm.id}: acquisition normId mismatch`);
  assert(a.sourceFile === norm.sourceFile, `${norm.id}: acquisition sourceFile mismatch`);
  assert(a.sourceHash === norm.sourceHash, `${norm.id}: acquisition sourceHash mismatch`);
  assert(Number.isInteger(a.unitCount) && a.unitCount >= 0, `${norm.id}: acquisition unitCount invalid`);
  assert(Number.isInteger(a.articleCount) && a.articleCount >= 0, `${norm.id}: acquisition articleCount invalid`);
  assert(nonEmptyString(a.firstCanonicalPath), `${norm.id}: acquisition firstCanonicalPath required`);
  assert(nonEmptyString(a.lastCanonicalPath), `${norm.id}: acquisition lastCanonicalPath required`);
  assert(validDateString(a.verifiedAt), `${norm.id}: acquisition verifiedAt invalid`);
  assert(a.verifiedAt === norm.lastVerifiedAt, `${norm.id}: acquisition verifiedAt must equal lastVerifiedAt`);
  assert(a.complete === true, `${norm.id}: acquisition complete must be true`);
}

export function validateNorm(norm){
  validateNormShape(norm);
  const ids = new Set();
  const paths = new Set();
  const byId = new Map();
  for(const unit of norm.units){
    assert(unit && typeof unit === 'object' && !Array.isArray(unit), `${norm.id}: unit must be object`);
    for(const field of ['id','parentId','kind','label','canonicalPath','heading','text','sortOrder','status']) assert(Object.hasOwn(unit, field), `${norm.id}: unit missing ${field}`);
    assert(nonEmptyString(unit.id) && unit.id.startsWith(`${norm.id}-`), `${unit.id}: id must start with norm id`);
    assert(unit.parentId === null || nonEmptyString(unit.parentId), `${unit.id}: parentId must be null or non-empty string`);
    assert(!ids.has(unit.id), `${unit.id}: duplicate id`); ids.add(unit.id); byId.set(unit.id, unit);
    assert(ALLOWED_KINDS.has(unit.kind), `${unit.id}: invalid kind ${unit.kind}`);
    assert(nonEmptyString(unit.label), `${unit.id}: label must be a non-empty string`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(unit.canonicalPath), `${unit.id}: invalid canonicalPath`);
    assert(unit.heading === null || typeof unit.heading === 'string', `${unit.id}: heading must be null or string`);
    assert(typeof unit.text === 'string', `${unit.id}: text must be string`);
    assert(!paths.has(unit.canonicalPath), `${unit.id}: duplicate canonicalPath ${unit.canonicalPath}`); paths.add(unit.canonicalPath);
    assert(Number.isInteger(unit.sortOrder) && unit.sortOrder >= 0, `${unit.id}: invalid sortOrder`);
    assert(nonEmptyString(unit.status), `${unit.id}: status must be a non-empty string`);
    if(TEXTUAL_KINDS.has(unit.kind)) assert(unit.text.trim(), `${unit.id}: textual unit requires text`);
  }
  for(const unit of norm.units){
    if(unit.parentId) assert(byId.has(unit.parentId), `${unit.id}: missing parent ${unit.parentId}`);
    const seen = new Set([unit.id]);
    let parent = unit.parentId ? byId.get(unit.parentId) : null;
    while(parent){
      assert(!seen.has(parent.id), `${unit.id}: parent cycle detected`);
      seen.add(parent.id);
      parent = parent.parentId ? byId.get(parent.parentId) : null;
    }
  }
  const sortedUnits = [...norm.units].sort((a,b)=>a.sortOrder-b.sortOrder || a.id.localeCompare(b.id));
  const articleCount = norm.units.filter(u=>u.kind === 'artigo').length;
  assert(norm.acquisition.unitCount === norm.units.length, `${norm.id}: acquisition unitCount does not match units`);
  assert(norm.acquisition.articleCount === articleCount, `${norm.id}: acquisition articleCount does not match articles`);
  assert(norm.acquisition.firstCanonicalPath === sortedUnits[0]?.canonicalPath, `${norm.id}: acquisition firstCanonicalPath mismatch`);
  assert(norm.acquisition.lastCanonicalPath === sortedUnits.at(-1)?.canonicalPath, `${norm.id}: acquisition lastCanonicalPath mismatch`);
  return { ...norm, units: sortedUnits };
}

export async function loadCorpus(dir='legal/corpus', options={}){
  const root = options.root || process.cwd();
  let entries;
  try { entries = await fs.readdir(path.resolve(root, dir)); }
  catch (error) {
    if(error?.code === 'ENOENT') return [];
    throw error;
  }
  const files = entries.filter(f=>f.endsWith('.json')).sort();
  const norms = [];
  for(const file of files){
    const filePath = path.resolve(root, dir, file);
    let parsed;
    try { parsed = JSON.parse(await fs.readFile(filePath,'utf8')); }
    catch (error) {
      if(error instanceof SyntaxError) throw new Error(`${path.join(dir,file)}: invalid JSON: ${error.message}`);
      throw error;
    }
    const norm = validateNorm(parsed);
    await verifySourceHash(norm, root);
    norms.push(norm);
  }
  norms.sort((a,b)=>a.id.localeCompare(b.id));
  return norms;
}

export function generatedAtFrom(norms, env=process.env){
  if(env.SOURCE_DATE_EPOCH){
    const seconds = Number(env.SOURCE_DATE_EPOCH);
    assert(Number.isInteger(seconds) && seconds >= 0, 'SOURCE_DATE_EPOCH must be a non-negative integer');
    return new Date(seconds * 1000).toISOString();
  }
  const times = norms.map(n=>Date.parse(n.lastVerifiedAt)).filter(Number.isFinite);
  assert(times.length > 0, 'generatedAt requires SOURCE_DATE_EPOCH or at least one valid lastVerifiedAt');
  return new Date(Math.max(...times)).toISOString();
}

export function buildPackage(norms, options={}){
  const generatedAt = options.generatedAt || generatedAtFrom(norms, options.env || process.env);
  const normalizedNorms = norms.map(validateNorm).sort((a,b)=>a.id.localeCompare(b.id));
  const normIds = normalizedNorms.map(n=>n.id).sort();
  const stable = { schemaVersion:1, packageId:'foundation', version:'foundation-v1', normIds, norms: normalizedNorms };
  return { ...stable, generatedAt, hash: sha256(stableStringify(stable)) };
}

export function stablePackageContent(pkg){
  return { schemaVersion:pkg.schemaVersion, packageId:pkg.packageId, version:pkg.version, normIds:pkg.normIds, norms:pkg.norms };
}

export function assertStablePackagesEqual(generated, built){
  if(generated.hash !== built.hash || stableStringify(stablePackageContent(generated)) !== stableStringify(stablePackageContent(built))){
    throw new Error('public/legal/foundation-v1.json is stale; run build-legal-package.mjs');
  }
}

export function verifyFoundation(pkg){
  assert(pkg && typeof pkg === 'object' && !Array.isArray(pkg), 'package: must be object');
  assert(pkg.schemaVersion === 1, 'package: schemaVersion must be 1');
  assert(pkg.packageId === 'foundation', 'package: packageId must be foundation');
  assert(nonEmptyString(pkg.version), 'package: version must be a non-empty string');
  assert(validDateString(pkg.generatedAt), 'package: generatedAt must be a valid date');
  assert(Array.isArray(pkg.normIds), 'package: normIds must be array');
  assert(Array.isArray(pkg.norms), 'package: norms must be array');
  assert(/^[a-f0-9]{64}$/.test(pkg.hash), 'package: invalid hash');
  const stable = stablePackageContent(pkg);
  assert(sha256(stableStringify(stable)) === pkg.hash, 'package: hash mismatch');
  const normIds = [...pkg.normIds];
  assert(normIds.every(nonEmptyString), 'package: normIds must be non-empty strings');
  assert(new Set(normIds).size === normIds.length, 'package: duplicate normIds');
  const normIdsFromNorms = pkg.norms.map(n=>n?.id);
  assert(new Set(normIdsFromNorms).size === normIdsFromNorms.length, 'package: duplicate norms');
  const sortedNormIds = [...normIdsFromNorms].sort();
  assert(stableStringify(normIds) === stableStringify([...normIds].sort()), 'package: normIds must be sorted');
  assert(stableStringify(normIds) === stableStringify(sortedNormIds), 'package: normIds must exactly match norms');
  const ids = new Set(normIds);
  for(const id of REQUIRED_NORMS) assert(ids.has(id), `package: missing required norm ${id}`);
  for(const norm of pkg.norms) validateNorm(norm);
  const cf = pkg.norms.find(n=>n.id==='cf88');
  const cpc = pkg.norms.find(n=>n.id==='cpc2015');
  assert(cf?.units.some(u=>u.kind==='preambulo'), 'cf88: missing preambulo smoke check');
  assert(cf?.units.some(u=>u.canonicalPath==='art1'), 'cf88: missing art1 smoke check');
  assert(cf?.units.some(u=>u.canonicalPath==='art5'), 'cf88: missing art5 smoke check');
  assert(cf?.units.some(u=>u.canonicalPath==='art5-inc35'), 'cf88: missing art5-inc35 smoke check');
  assert(cf?.units.some(u=>u.kind==='disposicao_transitoria'), 'cf88: missing ADCT smoke check');
  assert(cpc?.units.some(u=>u.canonicalPath==='art300'), 'cpc2015: missing art300 smoke check');
  return true;
}
