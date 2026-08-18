#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadCorpus, validateNorm } from './legal-corpus-lib.mjs';

/**
 * scripts/sync-legal-corpus.mjs
 *
 * Sincronizador determinístico e idempotente do corpus jurídico para o Supabase.
 * Usa as credenciais server-side SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY se permitido).
 */
export async function syncLegalCorpus(options = {}) {
  const env = options.env || process.env;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return {
      status: 'BLOCKED_NO_CREDENTIALS',
      message: 'Supabase URL ou Key não configurados no ambiente (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).'
    };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const norms = await loadCorpus(options.corpusDir || 'legal/corpus', { root: options.root || process.cwd() });
  if (!norms.length) {
    throw new Error('Nenhuma norma encontrada no corpus.');
  }

  const results = [];

  for (const norm of norms) {
    validateNorm(norm);
    const versionId = `${norm.id}-${norm.sourceHash.slice(0, 12)}`;

    // 1. Inserir ou atualizar legal_norm (sem current_version_id inicialmente se for nova para evitar violação de FK circular)
    const { error: normError } = await supabase
      .from('legal_norms')
      .upsert({
        id: norm.id,
        urn: norm.urn,
        type: norm.type,
        number: norm.number,
        year: norm.year,
        title: norm.title,
        popular_name: norm.popularName,
        ementa: norm.ementa,
        status: norm.status,
        publication_date: norm.publicationDate,
        official_source_url: norm.officialSourceUrl,
        last_verified_at: norm.lastVerifiedAt
      }, { onConflict: 'id' });

    if (normError) throw new Error(`Erro ao upsert legal_norms [${norm.id}]: ${normError.message}`);

    // 2. Inserir ou atualizar versão
    const { error: versionError } = await supabase
      .from('legal_versions')
      .upsert({
        id: versionId,
        norm_id: norm.id,
        version_date: norm.versionDate,
        source_hash: norm.sourceHash,
        source_url: norm.officialSourceUrl,
        is_current: true,
        reviewed_at: norm.lastVerifiedAt
      }, { onConflict: 'id, norm_id' });

    if (versionError) throw new Error(`Erro ao upsert legal_versions [${versionId}]: ${versionError.message}`);

    // 3. Atualizar current_version_id na norma
    const { error: normUpdateError } = await supabase
      .from('legal_norms')
      .update({ current_version_id: versionId })
      .eq('id', norm.id);

    if (normUpdateError) throw new Error(`Erro ao vincular current_version_id [${norm.id}]: ${normUpdateError.message}`);

    // 4. Inserir unidades em lotes (batch)
    const BATCH_SIZE = 200;
    const dbUnits = norm.units.map(u => ({
      id: u.id,
      norm_id: norm.id,
      version_id: versionId,
      parent_id: u.parentId,
      kind: u.kind,
      label: u.label,
      canonical_path: u.canonicalPath,
      heading: u.heading,
      text: u.text,
      sort_order: u.sortOrder,
      status: u.status
    }));

    for (let i = 0; i < dbUnits.length; i += BATCH_SIZE) {
      const batch = dbUnits.slice(i, i + BATCH_SIZE);
      const { error: unitError } = await supabase
        .from('legal_units')
        .upsert(batch, { onConflict: 'id, norm_id, version_id' });

      if (unitError) throw new Error(`Erro ao upsert legal_units batch [${i}..${i + batch.length}] na norma ${norm.id}: ${unitError.message}`);
    }

    results.push({
      normId: norm.id,
      versionId,
      unitCount: dbUnits.length,
      articleCount: norm.acquisition.articleCount
    });
  }

  return {
    status: 'PASS',
    results
  };
}

if (process.argv[1] && process.argv[1].endsWith('sync-legal-corpus.mjs')) {
  try {
    const outcome = await syncLegalCorpus();
    if (outcome.status === 'BLOCKED_NO_CREDENTIALS') {
      console.log(`CPC_PERSISTENCE=BLOCKED_NO_CREDENTIALS (${outcome.message})`);
    } else {
      console.log('CPC_PERSISTENCE=PASS');
      console.log('Results:', JSON.stringify(outcome.results, null, 2));
    }
  } catch (error) {
    console.error('Falha no sync com Supabase:', error?.message || error);
    process.exitCode = 1;
  }
}
