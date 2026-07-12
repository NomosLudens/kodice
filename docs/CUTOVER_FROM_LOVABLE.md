# Cutover from Lovable

Este projeto foi totalmente desvinculado do Lovable e do TanStack Start, adotando uma arquitetura local-first com configuração própria do Vite e do Supabase.

Após o merge do PR que consolida esta mudança, é **necessário** que o operador realize as seguintes ações operacionais:

1. **Desconectar o repositório do Lovable**: Acesse as configurações no painel do Lovable e remova o vínculo com este repositório no GitHub.
2. **Revogar acesso do GitHub**: Caso o Lovable não seja mais utilizado em outros projetos, revogue o acesso dele nas configurações de aplicações conectadas da sua conta do GitHub.
3. **Arquivar ou excluir no Lovable**: Exclua ou arquive o projeto no painel do Lovable.
4. **Gerenciamento de Dados Legados**: 
   - Se houver dados úteis nos projetos antigos do Supabase (`sfslfvaoopaagxmvjwjl` e `bemhmggguanojzaahudc`), faça um backup ou exportação.
   - Desative e exclua os projetos antigos no painel do Supabase para evitar custos ou exposição indesejada.
5. **Criação do Novo Supabase**: Crie um novo projeto no Supabase, conforme as instruções do `README.md`, e aplique as migrations contidas em `supabase/migrations`.
6. **Configuração de Variáveis de Ambiente**:
   - Localmente, preencha o `.env` seguindo o modelo de `.env.example`.
   - Na Cloudflare Pages, adicione as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. **Auth Redirects**: Configure a **Site URL** do novo projeto Supabase e os redirects permitidos (URLs locais, previews do Cloudflare, e o domínio de produção).
8. **Testes em Produção**: Verifique o funcionamento do app realizando testes de ponta a ponta com duas contas distintas, para garantir que o isolamento de filas e o RLS (Row Level Security) estão plenamente ativos.
