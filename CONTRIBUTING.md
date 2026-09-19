# Contribuindo com o Kódice

Agradecemos o interesse em contribuir com o **Kódice**.

---

## 1. Princípios do Projeto

1. **Reprodutibilidade Estrita:** Todas as alterações devem preservar a capacidade de clonagem e reprodução autônoma do projeto (`bun run reproduce:verify`).
2. **Determinismo Normativo:** Nenhuma modificação no corpus jurídico pode ser realizada sem correspondência direta com os textos oficiais publicados no Diário Oficial / Planalto.
3. **Local-First & Privacidade:** O leitor deve permanecer 100% utilizável sem conexão e sem transmissão de documentos pessoais.
4. **Sem Secrets no Repositório:** Nenhuma chave privada, token ou URL de infraestrutura interna deve ser introduzida no código fonte ou na documentação.

---

## 2. Fluxo de Desenvolvimento

1. Crie uma branch a partir de `master`:
   ```bash
   git checkout -b feature/minha-melhoria
   ```
2. Instale dependências:
   ```bash
   bun install --frozen-lockfile
   ```
3. Execute o ambiente de desenvolvimento integrado:
   ```bash
   bun run dev:full
   ```
4. Antes de submeter seu pull request, certifique-se de que todos os testes e verificações passam:
   ```bash
   bun run reproduce:verify
   ```
