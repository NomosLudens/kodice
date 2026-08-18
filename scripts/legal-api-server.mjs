#!/usr/bin/env node
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

/**
 * scripts/legal-api-server.mjs
 *
 * Servidor HTTP nativo (node:http) para a API jurídica privada do Kódice na VM Mini.
 * Consulta o banco SQLite persistente.
 */

export function createLegalApiHandler(db, options = {}) {
  const allowedOrigins = options.allowedOrigins || ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://kaline-box.taildb6c11.ts.net'];

  const getNormStmt = db.prepare(`
    SELECT n.*, v.id as version_id, v.version_date, v.source_hash
    FROM legal_norms n
    LEFT JOIN legal_versions v ON v.id = n.current_version_id
    WHERE n.id = ?
  `);

  const getUnitStmt = db.prepare(`
    SELECT u.*
    FROM legal_units u
    JOIN legal_norms n ON n.id = u.norm_id AND n.current_version_id = u.version_id
    WHERE u.norm_id = ? AND u.canonical_path = ?
  `);

  return (req, res) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;

    // 1. Health
    if (pathname === '/health' || pathname === '/api/legal/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'kodice-legal-api' }));
      return;
    }

    // 2. Unit lookup: /api/legal/norms/:normId/units/:canonicalPath
    const unitMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)\/units\/([^/]+)$/);
    if (unitMatch) {
      const normId = decodeURIComponent(unitMatch[1]);
      const canonicalPath = decodeURIComponent(unitMatch[2]);

      const unit = getUnitStmt.get(normId, canonicalPath);
      if (!unit) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal unit not found', normId, canonicalPath }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: unit.id,
        normId: unit.norm_id,
        versionId: unit.version_id,
        parentId: unit.parent_id,
        kind: unit.kind,
        label: unit.label,
        canonicalPath: unit.canonical_path,
        heading: unit.heading,
        text: unit.text,
        sortOrder: unit.sort_order,
        status: unit.status
      }));
      return;
    }

    // 3. Norm lookup: /api/legal/norms/:normId
    const normMatch = pathname.match(/^\/api\/legal\/norms\/([^/]+)$/);
    if (normMatch) {
      const normId = decodeURIComponent(normMatch[1]);
      const norm = getNormStmt.get(normId);

      if (!norm) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Legal norm not found', normId }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: norm.id,
        urn: norm.urn,
        type: norm.type,
        number: norm.number,
        year: norm.year,
        title: norm.title,
        popularName: norm.popular_name,
        ementa: norm.ementa,
        status: norm.status,
        publicationDate: norm.publication_date,
        officialSourceUrl: norm.official_source_url,
        currentVersionId: norm.current_version_id,
        lastVerifiedAt: norm.last_verified_at
      }));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  };
}

export function startLegalApiServer(dbPath, port = 4520, host = '127.0.0.1') {
  const db = new DatabaseSync(dbPath);
  const handler = createLegalApiHandler(db);
  const server = http.createServer(handler);

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      resolve({ server, db, port, host });
    });
    server.on('error', reject);
  });
}

if (process.argv[1] && process.argv[1].endsWith('legal-api-server.mjs')) {
  const dbPath = process.env.KODICE_LEGAL_DB || '/var/lib/kodice/legal.db';
  const port = parseInt(process.env.KODICE_LEGAL_PORT || '4520', 10);
  const host = process.env.KODICE_LEGAL_HOST || '127.0.0.1';

  startLegalApiServer(dbPath, port, host).then(({ port, host }) => {
    console.log(`Kódice Legal API listening on http://${host}:${port}`);
  }).catch(err => {
    console.error('Failed to start Legal API server:', err);
    process.exit(1);
  });
}
