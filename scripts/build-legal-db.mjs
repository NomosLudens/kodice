#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadCorpus, validateNorm } from './legal-corpus-lib.mjs';

/**
 * scripts/build-legal-db.mjs
 *
 * Materializador determinístico e idempotente do corpus jurídico para SQLite.
 * Pode ser executado localmente ou na VM Mini.
 */

export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS legal_norms (
  id TEXT PRIMARY KEY,
  urn TEXT UNIQUE,
  type TEXT NOT NULL,
  number TEXT,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  popular_name TEXT NOT NULL,
  ementa TEXT NOT NULL,
  status TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  official_source_url TEXT NOT NULL,
  current_version_id TEXT,
  last_verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legal_versions (
  id TEXT PRIMARY KEY,
  norm_id TEXT NOT NULL,
  version_date TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_url TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT NOT NULL,
  FOREIGN KEY (norm_id) REFERENCES legal_norms(id) ON DELETE CASCADE,
  UNIQUE (id, norm_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_versions_one_current_per_norm_idx 
ON legal_versions (norm_id) WHERE is_current = 1;

CREATE TABLE IF NOT EXISTS legal_units (
  id TEXT PRIMARY KEY,
  norm_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  heading TEXT,
  text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  UNIQUE (norm_id, version_id, canonical_path),
  FOREIGN KEY (norm_id) REFERENCES legal_norms(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id, norm_id) REFERENCES legal_versions(id, norm_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS legal_units_lookup_idx 
ON legal_units (norm_id, version_id, canonical_path);

CREATE INDEX IF NOT EXISTS legal_units_sort_idx 
ON legal_units (norm_id, version_id, sort_order);
`;

export async function buildLegalDatabase(dbPath, options = {}) {
  const root = options.root || process.cwd();
  const corpusDir = options.corpusDir || 'legal/corpus';
  const norms = await loadCorpus(corpusDir, { root });
  if (!norms.length) {
    throw new Error('Nenhuma norma encontrada no corpus.');
  }

  if (dbPath !== ':memory:') {
    await fs.mkdir(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SQLITE_SCHEMA);

  const insertNormStmt = db.prepare(`
    INSERT INTO legal_norms (
      id, urn, type, number, year, title, popular_name, ementa,
      status, publication_date, official_source_url, current_version_id, last_verified_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      urn = excluded.urn,
      type = excluded.type,
      number = excluded.number,
      year = excluded.year,
      title = excluded.title,
      popular_name = excluded.popular_name,
      ementa = excluded.ementa,
      status = excluded.status,
      publication_date = excluded.publication_date,
      official_source_url = excluded.official_source_url,
      current_version_id = excluded.current_version_id,
      last_verified_at = excluded.last_verified_at
  `);

  const unsetCurrentVersionsStmt = db.prepare(`
    UPDATE legal_versions SET is_current = 0 WHERE norm_id = ?
  `);

  const insertVersionStmt = db.prepare(`
    INSERT INTO legal_versions (
      id, norm_id, version_date, source_hash, source_url, is_current, reviewed_at
    ) VALUES (
      ?, ?, ?, ?, ?, 1, ?
    )
    ON CONFLICT(id, norm_id) DO UPDATE SET
      version_date = excluded.version_date,
      source_hash = excluded.source_hash,
      source_url = excluded.source_url,
      is_current = 1,
      reviewed_at = excluded.reviewed_at
  `);

  const deleteUnitsForVersionStmt = db.prepare(`
    DELETE FROM legal_units WHERE norm_id = ? AND version_id = ?
  `);

  const insertUnitStmt = db.prepare(`
    INSERT INTO legal_units (
      id, norm_id, version_id, parent_id, kind, label,
      canonical_path, heading, text, sort_order, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(norm_id, version_id, canonical_path) DO UPDATE SET
      id = excluded.id,
      parent_id = excluded.parent_id,
      kind = excluded.kind,
      label = excluded.label,
      heading = excluded.heading,
      text = excluded.text,
      sort_order = excluded.sort_order,
      status = excluded.status
  `);

  const results = [];

  for (const norm of norms) {
    validateNorm(norm);
    const versionId = `${norm.id}-${norm.sourceHash.slice(0, 12)}`;

    // Transação por norma
    db.exec('BEGIN TRANSACTION;');
    try {
      insertNormStmt.run(
        norm.id, norm.urn, norm.type, norm.number, norm.year,
        norm.title, norm.popularName, norm.ementa, norm.status,
        norm.publicationDate, norm.officialSourceUrl, versionId, norm.lastVerifiedAt
      );

      unsetCurrentVersionsStmt.run(norm.id);

      insertVersionStmt.run(
        versionId, norm.id, norm.versionDate, norm.sourceHash,
        norm.officialSourceUrl, norm.lastVerifiedAt
      );

      deleteUnitsForVersionStmt.run(norm.id, versionId);

      for (const unit of norm.units) {
        insertUnitStmt.run(
          unit.id, norm.id, versionId, unit.parentId,
          unit.kind, unit.label, unit.canonicalPath,
          unit.heading, unit.text, unit.sortOrder, unit.status
        );
      }

      db.exec('COMMIT;');

      results.push({
        normId: norm.id,
        versionId,
        unitCount: norm.units.length,
        articleCount: norm.acquisition.articleCount
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  return { db, results };
}

if (process.argv[1] && process.argv[1].endsWith('build-legal-db.mjs')) {
  const targetDb = process.env.KODICE_LEGAL_DB || path.resolve(process.cwd(), 'legal.db');
  try {
    const { results } = await buildLegalDatabase(targetDb);
    console.log(`SQLite database successfully built at ${targetDb}`);
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Falha ao materializar banco SQLite:', error?.message || error);
    process.exitCode = 1;
  }
}
