# Kódice — Guia de Reprodutibilidade

Este documento especifica os procedimentos exatos para verificar de forma autônoma e determinística a integridade do código, do corpus normativo e da materialização do banco de dados do **Kódice**.

---

## 1. Pré-requisitos Mínimos

* **Sistema Operacional:** Linux, macOS ou WSL2 no Windows.
* **Node.js:** `>= 22.5.0` (necessário para suporte ao módulo nativo `node:sqlite`).
* **Bun:** `1.3.14` ou compatível (gerenciador de pacotes canônico e executor do projeto).
* **Git:** `>= 2.30`.

---

## 2. Clonagem e Inicialização Limpa

Clone o repositório sem necessidade de credenciais ou autenticação:

```bash
git clone https://github.com/NomosLudens/kodice.git
cd kodice
```

Instale as dependências usando o lockfile imutável do projeto (`bun.lock`):

```bash
bun install --frozen-lockfile
```

---

## 3. Verificação Automatizada Integral

O projeto disponibiliza um verificador completo de reprodutibilidade em passo único:

```bash
bun run reproduce:verify
```

### O que este comando executa (Prova Integral em 10 Etapas):

1. **Limpeza:** Remove resíduos do banco SQLite gerado (`legal.db`, `-wal`, `-shm`).
2. **Reconstrução Determinística:** Materializa todas as 61 normas do corpus oficial no banco SQLite.
3. **Validação de Hash Canônico e Contagens:**
   * Normas: `61`
   * Versões: `61`
   * Unidades: `36.045`
   * Hash Lógico SHA-256 do SQLite:
     ```
     7e09b098072983fb87854e5e2fcceed809bde308069e37b454b07e4d15aa512f
     ```
4. **Camada Jurídica:** Executa testes unitários do SQLite e testes de contrato da API jurídica.
5. **Verificação do Corpus:** Audita a integridade semântica dos 61 diplomas em `legal/corpus/`.
6. **Fronteiras e Desacoplamento:** Audita ausência de URLs e segredos privados, e testa a autenticação da Estação.
7. **Build do Frontend:** Compila os assets web de produção via Vite.
8. **Service Worker PWA:** Constrói o Service Worker e injeta o manifesto de precache offline.
9. **Bateria Canônica de Interface:** Executa testes do motor PDF em Web Worker, regressões P1, leitor e superfície do Vade Mecum (Puppeteer).
10. **Auditoria PWA:** Valida o precache estático e garante a integridade dos artefatos do aplicativo offline.

---

## 4. Ambiente de Desenvolvimento Completo

Para iniciar simultaneamente o backend da API jurídica e o servidor de desenvolvimento do frontend:

```bash
bun run dev:full
```

* **Frontend:** [http://localhost:5173](http://localhost:5173)
* **API Jurídica:** [http://127.0.0.1:4520/api/legal/catalog](http://127.0.0.1:4520/api/legal/catalog)
* **Status da API:** [http://127.0.0.1:4520/health](http://127.0.0.1:4520/health)

O aplicativo abrirá diretamente no **Vade Mecum Jurídico**, permitindo a consulta imediata aos 61 diplomas legais locais.
