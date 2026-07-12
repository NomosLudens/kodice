# Códice

Um leitor local de EPUB, PDF e TXT focado em privacidade, retenção e conforto.

## Arquitetura Local-First
O Códice é primariamente uma aplicação offline. Seus livros, progresso e anotações são salvos localmente no seu dispositivo utilizando **IndexedDB**. Nada é enviado para a nuvem por padrão, garantindo total privacidade e funcionamento sem internet.

Opcionalmente, você pode configurar o Supabase para sincronizar seu progresso, notas e preferências entre dispositivos. Os arquivos dos livros **nunca** são enviados para a nuvem.

## Instalação e Desenvolvimento

O projeto foi construído usando **Vite** e **Bun**.

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   bun install
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   bun run dev
   ```
4. Para gerar a build de produção:
   ```bash
   bun run build
   ```
   Os arquivos finais serão gerados na pasta `dist/`.

## Configuração do Supabase Próprio (Opcional)

Para ativar a sincronização entre dispositivos, você precisa de um projeto Supabase.

1. Crie um projeto no [Supabase](https://supabase.com).
2. Aplique as migrations iniciais localizadas na pasta `supabase/migrations/` no SQL Editor do seu projeto Supabase. Elas criarão as tabelas necessárias e as políticas RLS.
3. Configure os domínios permitidos para redirecionamento em **Authentication > URL Configuration** (adicione o domínio local e o domínio de produção).
4. Crie um arquivo `.env` na raiz do projeto (copie de `.env.example`):
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_anon_aqui
   ```

## Configuração do Cloudflare Pages

O Códice está pronto para ser hospedado gratuitamente no Cloudflare Pages.

1. Conecte o seu repositório ao Cloudflare Pages.
2. Nas configurações de build:
   - **Framework preset**: Vite (ou nenhum)
   - **Build command**: `bun run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
3. Nas variáveis de ambiente do Cloudflare Pages, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

Após o deploy, certifique-se de validar o login/sincronização e adicionar o domínio gerado ao seu projeto Supabase.
