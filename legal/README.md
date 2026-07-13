# Vade Mecum Foundation

Este diretório contém a base canônica para o corpus jurídico estruturado do Kódice.

## Regra de integridade

O pacote público `public/legal/foundation-v1.json` é gerado por `scripts/build-legal-package.mjs` a partir de `legal/corpus/*.json`.

O campo `hash` do pacote é o SHA-256 do conteúdo estável do manifesto, calculado sobre:

- `schemaVersion`
- `packageId`
- `version`
- `normIds`
- `norms`

O campo `generatedAt` fica fora do material hasheado para manter o hash determinístico em builds repetidos com o mesmo corpus.

## Gate de corpus

Nenhum texto jurídico deve ser escrito manualmente ou inventado. Antes de adicionar uma norma em `legal/corpus`, confirme fonte oficial, URL, versão, data de verificação, hash SHA-256 do material de origem e estrutura integral validada.

Se Constituição Federal, ADCT e CPC não puderem ser obtidos e conferidos em fonte oficial, o resultado do PR permanece: **BLOQUEADO — CORPUS OFICIAL AUSENTE**.
