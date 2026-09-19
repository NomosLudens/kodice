# Kódice — Guia de Reprodutibilidade

Este documento especifica os procedimentos exatos para verificar de forma autônoma e determinística a integridade do código, do corpus normativo e da materialização do banco de dados do **Kódice**.

---

## 1. Pré-requisitos Mínimos

* **Sistema Operacional:** Linux, macOS ou WSL2 no Windows.
* **Runtime:** Node.js `>= 20.x` ou Bun `>= 1.0`.
* **Git:** `>= 2.30`.

---

## 2. Clonagem e Inicialização Limpa

Clone o repositório sem necessidade de credenciais ou autenticação:

```bash
git clone https://github.com/NomosLudens/kodice.git
cd kodice
```

Instale as dependências usando os lockfiles imutáveis do projeto:

```bash
# Via Bun (recomendado):
bun install --frozen-lockfile

# Ou via npm:
npm ci
```

---

## 3. Verificação Automatizada Integral

O projeto disponibiliza um verificador completo de reprodutibilidade em passo único:

```bash
bun run reproduce:verify
```

### O que este comando executa:

1. **Reconstrução Limpa:** Remove qualquer resíduo de `legal.db` existente e rematerializa todas as 61 normas a partir das fontes declarativas em `legal/corpus/`.
2. **Conferência Relacional e Hash Canônico:**
   * Normas: `61`
   * Versões: `61`
   * Unidades: `36.045`
   * Hash Lógico SHA-256 do SQLite:
     ```
     7e09b098072983fb87854e5e2fcceed809bde308069e37b454b07e4d15aa512f
     ```
3. **Auditoria de Fronteiras:** Verifica a inexistência de URLs ou credenciais privadas no frontend e fontes do projeto.
4. **Testes Unitários e de Integração:** Executa os testes de autenticação da Estação, integridade do SQLite e contratos da API jurídica.
5. **Build de Produção:** Constrói os bundles estáticos do frontend e valida precaching do Service Worker.

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
