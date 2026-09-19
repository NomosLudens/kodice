#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

export function computeDbLogicalHash(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const hash = crypto.createHash('sha256');

  // 1. Norms
  const norms = db.prepare(`
    SELECT id, urn, type, number, year, title, popular_name, ementa, status, publication_date, official_source_url
    FROM legal_norms
    ORDER BY id
  `).all();
  hash.update(`NORMS:${norms.length}\n`);
  for (const n of norms) {
    hash.update(JSON.stringify(n) + '\n');
  }

  // 2. Versions
  const versions = db.prepare(`
    SELECT id, norm_id, version_date, source_hash, source_url, is_current
    FROM legal_versions
    ORDER BY id, norm_id
  `).all();
  hash.update(`VERSIONS:${versions.length}\n`);
  for (const v of versions) {
    hash.update(JSON.stringify(v) + '\n');
  }

  // 3. Units
  const units = db.prepare(`
    SELECT id, norm_id, version_id, parent_id, kind, label, canonical_path, heading, text, sort_order, status
    FROM legal_units
    ORDER BY norm_id, version_id, canonical_path
  `).all();
  hash.update(`UNITS:${units.length}\n`);
  for (const u of units) {
    hash.update(JSON.stringify(u) + '\n');
  }

  db.close();
  return {
    logicalHash: hash.digest('hex'),
    normsCount: norms.length,
    versionsCount: versions.length,
    unitsCount: units.length,
  };
}

if (process.argv[1] && process.argv[1].endsWith('compute-db-logical-hash.mjs')) {
  const dbPath = process.argv[2] || process.env.KODICE_LEGAL_DB || 'legal.db';
  try {
    const res = computeDbLogicalHash(dbPath);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error computing logical hash:', err.message);
    process.exit(1);
  }
}
