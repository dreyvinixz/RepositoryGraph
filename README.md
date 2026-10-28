# RepositoryGraph

Central de gerenciamento visual dos seus repositórios GitHub.

**Versão em desenvolvimento:** v0.1.0 — Vite + React + TypeScript. Dashboard, importação de repositórios reais, pesquisa, favoritos e coleções, com persistência local e sincronização opcional no Supabase.

## Como executar

Requisitos: Node.js 22.12+ e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Acesse o endereço exibido pelo Vite. Sem nenhuma configuração externa, é possível importar repositórios **públicos** pelo usuário GitHub e salvar as preferências neste navegador.

Para incluir repositórios privados, é possível fornecer **temporariamente** um token GitHub fine-grained com acesso somente aos repositórios selecionados e permissão **Metadata: Read**. Ele é usado apenas na requisição; não é salvo no localStorage nem na nuvem. Em produção, a integração deverá migrar para GitHub App read-only e sincronização no servidor.

## Supabase (opcional)

1. Crie um projeto Supabase de desenvolvimento separado e execute a migration em `supabase/migrations/`.
2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env`.
3. Habilite o provedor GitHub no Supabase Auth e configure os callback/redirect URLs para seu projeto e a URL de desenvolvimento.
4. Use **Entrar com GitHub**. A sessão do Supabase habilita a sincronização de coleções e metadados na tabela `repository_workspaces`, isolada por RLS.

> A autenticação do Supabase não fornece por si só acesso de leitura a todos os repositórios privados. No MVP, a importação privada exige token fine-grained temporário; o token não é armazenado.

## Comandos

```bash
npm run dev
npm run typecheck
npm run build
npm run test
```

## Escopo

### v0.1.0
- Dashboard com números calculados a partir dos dados importados.
- Importação paginada via GitHub REST; inclui repositórios próprios e acessíveis pelo token temporário.
- Busca, filtros por visibilidade, ordenação e favoritos.
- Coleções de repositórios (criar, selecionar e adicionar/remover repositórios).
- Persistência local para dados públicos e sincronização Supabase opcional com RLS.
- Layout responsivo e estados de loading, erro e lista vazia.

### Próximas versões
- v0.2.0: GitHub App de permissões mínimas, issues, PRs, Kanban.
- v0.3.0: agenda e planejamento.
- v0.4.0: grafo de repositórios.
- v0.5.0: CI/CD e analytics.

## Segurança e limites

- Nunca coloque `service_role`, token GitHub, GitHub App private key ou outras credenciais em variáveis `VITE_*`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` pode ser pública; toda leitura/escrita de dados deve passar pela RLS.
- Tokens temporários de GitHub são mantidos apenas em memória enquanto o formulário de importação está aberto.
- Repositórios privados não são persistidos em localStorage. Quando conectado ao Supabase, o estado completo pode ser armazenado no banco do usuário.
- O frontend não executa commits, exclusões ou operações mutáveis nos repositórios importados.
- `npm install` cria o `package-lock.json`; faça commit do lockfile antes de mesclar a PR para tornar a instalação determinística.

Licença a definir pelo mantenedor.
