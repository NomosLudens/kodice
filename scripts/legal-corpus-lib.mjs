import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const REQUIRED_NORMS = new Set(['cf88', 'cpc2015']);
export const TEXTUAL_KINDS = new Set(['preambulo','artigo','paragrafo','inciso','alinea','item','disposicao_transitoria']);
export const ALLOWED_KINDS = new Set(['preambulo','parte','livro','titulo','capitulo','secao','subsecao','artigo','paragrafo','inciso','alinea','item','disposicao_transitoria']);

export function stableStringify(value){
  if(Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if(value && typeof value === 'object'){
    return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value){ return createHash('sha256').update(value).digest('hex'); }

function assert(cond, msg){ if(!cond) throw new Error(msg); }
function isHttps(value){ try { return new URL(value).protocol === 'https:'; } catch { return false; } }

export function validateNorm(norm){
  for(const field of ['id','urn','type','year','title','popularName','aliases','ementa','status','publicationDate','versionDate','officialSourceUrl','sourceHash','lastVerifiedAt','units']){
    assert(Object.hasOwn(norm, field), `${norm?.id || 'norm'}: missing ${field}`);
  }
  assert(/^[a-z][a-z0-9-]*$/.test(norm.id), `${norm.id}: invalid norm id`);
  assert(isHttps(norm.officialSourceUrl), `${norm.id}: officialSourceUrl must be https`);
  assert(/^[a-f0-9]{64}$/.test(norm.sourceHash), `${norm.id}: sourceHash must be sha256 hex`);
  assert(!Number.isNaN(Date.parse(norm.lastVerifiedAt)), `${norm.id}: invalid lastVerifiedAt`);
  assert(Array.isArray(norm.aliases) && norm.aliases.length > 0, `${norm.id}: aliases required`);
  assert(Array.isArray(norm.units), `${norm.id}: units must be array`);
  const ids = new Set();
  const paths = new Set();
  const byId = new Map();
  for(const unit of norm.units){
    for(const field of ['id','kind','label','canonicalPath','sortOrder','status']) assert(Object.hasOwn(unit, field), `${norm.id}: unit missing ${field}`);
    assert(unit.id.startsWith(`${norm.id}-`), `${unit.id}: id must start with norm id`);
    assert(!ids.has(unit.id), `${unit.id}: duplicate id`); ids.add(unit.id); byId.set(unit.id, unit);
    assert(ALLOWED_KINDS.has(unit.kind), `${unit.id}: invalid kind ${unit.kind}`);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(unit.canonicalPath), `${unit.id}: invalid canonicalPath`);
    assert(!paths.has(unit.canonicalPath), `${unit.id}: duplicate canonicalPath ${unit.canonicalPath}`); paths.add(unit.canonicalPath);
    assert(Number.isInteger(unit.sortOrder) && unit.sortOrder >= 0, `${unit.id}: invalid sortOrder`);
    if(TEXTUAL_KINDS.has(unit.kind)) assert(typeof unit.text === 'string' && unit.text.trim(), `${unit.id}: textual unit requires text`);
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
  return { ...norm, units:[...norm.units].sort((a,b)=>a.sortOrder-b.sortOrder || a.id.localeCompare(b.id)) };
}

export async function loadCorpus(dir='legal/corpus'){
  const files = (await fs.readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.json')).sort();
  const norms = [];
  for(const file of files){
    const raw = await fs.readFile(path.join(dir,file),'utf8');
    norms.push(validateNorm(JSON.parse(raw)));
  }
  norms.sort((a,b)=>a.id.localeCompare(b.id));
  return norms;
}

export function buildPackage(norms, generatedAt=new Date().toISOString()){
  const normIds = norms.map(n=>n.id).sort();
  const stable = { schemaVersion:1, packageId:'foundation', version:'foundation-v1', normIds, norms };
  return { ...stable, generatedAt, hash: sha256(stableStringify(stable)) };
}

export function verifyFoundation(pkg){
  assert(pkg?.schemaVersion === 1, 'package: schemaVersion must be 1');
  assert(pkg.packageId === 'foundation', 'package: packageId must be foundation');
  assert(/^[a-f0-9]{64}$/.test(pkg.hash), 'package: invalid hash');
  const stable = { schemaVersion:pkg.schemaVersion, packageId:pkg.packageId, version:pkg.version, normIds:pkg.normIds, norms:pkg.norms };
  assert(sha256(stableStringify(stable)) === pkg.hash, 'package: hash mismatch');
  const ids = new Set(pkg.normIds || []);
  for(const id of REQUIRED_NORMS) assert(ids.has(id), `package: missing required norm ${id}`);
  for(const norm of pkg.norms || []) validateNorm(norm);
  const cf = pkg.norms.find(n=>n.id==='cf88');
  const cpc = pkg.norms.find(n=>n.id==='cpc2015');
  assert(cf?.units.some(u=>u.kind==='preambulo'), 'cf88: missing preambulo');
  assert(cf?.units.some(u=>u.canonicalPath==='art1'), 'cf88: missing art1');
  assert(cf?.units.some(u=>u.canonicalPath==='art5'), 'cf88: missing art5');
  assert(cf?.units.some(u=>u.canonicalPath==='art5-inc35'), 'cf88: missing art5-inc35');
  assert(cf?.units.some(u=>u.kind==='disposicao_transitoria'), 'cf88: missing ADCT');
  assert(cpc?.units.some(u=>u.canonicalPath==='art300'), 'cpc2015: missing art300');
  return true;
}
