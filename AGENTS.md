# QA Manager — contexto para agentes

Leia este arquivo antes de alterar o projeto. O sistema é uma ferramenta simples de gestão de testes manuais, inicialmente para uso pessoal de QA e apresentações internas. A prioridade do produto é **reduzir cliques e manter uma visão semelhante à objetividade de uma planilha**.

## Regras permanentes

- Nunca adicionar Docker, containers ou dependências obrigatórias de serviços externos.
- O sistema deve funcionar integralmente em localhost após `npm run setup`.
- Interface e mensagens em português do Brasil.
- Usar somente fontes sem serifa e manter controles de formulário com tamanhos lineares.
- Preservar o fluxo único: caso + execução + bug opcional são registrados no mesmo formulário.
- Se o teste passou, salvar encerra o fluxo. Se falhou, mostrar os detalhes do bug no mesmo contexto.
- Não transformar bugs em um gerenciador complexo de tarefas.
- Autorizações vêm de `AccessProfile.permissions`; os nomes dos perfis são cadastráveis pelo administrador.
- A exclusão confirmada de um teste é completa: remove caso, execuções, bugs, comentários e evidências relacionadas.
- Não editar arquivos dentro de `apps/api/data`, `dist` ou `node_modules` manualmente.

## Stack e comandos

- Monorepo npm workspaces.
- Web: React, Webpack e TypeScript em `apps/web`. Webpack foi escolhido por não depender dos binários não assinados bloqueados pelo WDAC corporativo.
- API: Fastify e TypeScript em `apps/api`.
- Banco: SQLite + Prisma em `apps/api/data/qa-manager.db`.
- Contratos e rótulos: `packages/shared`.

```bash
npm run setup       # dependências, schema e seed
npm run dev         # web :5173 e API :3333
npm test            # testes de todos os workspaces
npm run test:e2e    # testes end-to-end (Playwright) contra o app rodando
npm run build       # validação TypeScript e build Webpack
npm start           # inicia o build de produção da API e da Web
npm run db:deploy   # aplica o schema sem carregar dados demonstrativos
npm run backup      # banco e uploads
```

Sempre execute `npm test` e `npm run build` depois de mudanças. Não reintroduza Vite, Rollup, esbuild ou `tsx`: a política WDAC desta máquina exige assinatura empresarial e bloqueia seus binários nativos. Em Windows, se o Prisma retornar `EPERM` ao gerar o client, encerre apenas os processos Node deste projeto e tente novamente. Todo texto de interface e mensagens de erro deve ser digitado/revisado em UTF-8 (PT-BR) — evite editores ou pipes que regravem acentos como `Ã©`, `Ã§Ã£o` etc.

`packages/shared` publica tipos via `dist/` (`main`/`types` no seu `package.json`), pasta que é gerada por build e ignorada pelo Git — por isso `npm run setup` builda `@qa/shared` antes de `db:setup -w @qa/api` (`package.json`). Se esse passo for pulado ou interrompido, `tsc` falha com `Cannot find module '@qa/shared'` em `apps/api` e `apps/web`, e como `db:setup` é uma cadeia `prisma db push && tsc && seed.js`, o mesmo erro de `tsc` interrompe a cadeia *depois* do `db push` — o banco fica com o schema criado mas sem o usuário administrador (login falha com "E-mail ou senha inválidos"). Recuperação: rode `npm run build -w @qa/shared` e depois `npm run db:setup -w @qa/api` (ou `npm run setup` de novo). Separadamente, se o link do workspace em `node_modules/@qa/shared` tiver sido criado como pasta vazia em vez de link para `packages/shared`, rode `npm install` na raiz (com os processos Node do projeto parados) para recriá-lo.

### Testes end-to-end (`e2e/`, Playwright)

- `playwright.config.ts` sobe o `npm run dev` automaticamente (`webServer`) se ele ainda não estiver rodando, e reaproveita se já estiver.
- Pelo mesmo motivo do Webpack: o Chromium que o Playwright baixaria por padrão é bloqueado pelo WDAC. A config usa `channel: "msedge"`, que faz o Playwright abrir o Edge já instalado no Windows em vez de baixar o próprio navegador — não reverta isso para o Chromium padrão nesta máquina.
- Cada teste que cria dados (casos, ciclos etc.) deve apagar o que criou ao final — os testes rodam contra o mesmo banco local usado no dia a dia, não um banco isolado de teste.
- `e2e/helpers.ts` tem o `login()` reutilizável; ao adicionar novo teste que rode em viewport mobile, cuidado com elementos que o CSS esconde em telas estreitas (ex.: `.userCard`/"Sair" somem em telas ≤1000px).

## Produção em VPS

- Ambiente-alvo: VPS Linux com Node.js 24.x, systemd e Nginx.
- `npm start` carrega `apps/api/dist/src/server.js`; Fastify serve Web, API e uploads.
- A API deve escutar apenas em `127.0.0.1`; o acesso externo passa pelo Nginx com HTTPS.
- Configurar `NODE_ENV=production`, `SESSION_SECRET`, `WEB_ORIGIN` e `API_PORT` fora do repositório.
- Cookies são `secure` quando `NODE_ENV=production`.
- `apps/api/data` é persistente e nunca pode ser substituído durante atualizações.
- Instruções e modelos de serviço estão em `DEPLOY_VPS.md` e `ops/`.

## Organização funcional

- `TestCase` guarda a definição reutilizável e a data principal do teste.
- `Execution` guarda o resultado por caso e ciclo; existe no máximo uma por par caso/ciclo.
- `Bug` existe apenas para uma execução que falhou.
- `AuditLog` registra alterações críticas.
- Evidências ficam em `apps/api/data/uploads` e seus metadados no SQLite.
- IDs visíveis seguem `CT-001`, `CT-002` etc.; nunca reutilizar um código excluído.

## Interface atual

- `AppFinal.tsx` é o entrypoint funcional da aplicação.
- Sidebar recolhível com controle circular junto ao logo.
- Testes: formulário unificado, edição, duplicação, exclusão, passos, filtros por data, edição rápida de resultado, modelos, colunas configuráveis e filtros favoritos.
- Bugs: busca, filtros, passos, anotações e atualização de status respeitando o perfil. Alterações geram badge, aviso visual e som após interação do usuário.
- Tabelas largas aceitam rolagem horizontal tradicional e arraste com o botão esquerdo em áreas não interativas.
- Preferências de interface usam `localStorage` com prefixo `qa_`. Modelos são centralizados no SQLite (`TestTemplate`) e compartilhados entre navegadores; valores antigos de `qa_templates` são migrados automaticamente.
- Configurações > Cadastros gerencia modelos, ciclos, módulos e tipos. Todos podem ser renomeados; a remoção desativa para novas seleções e preserva o histórico.
- Exclusão de usuário é definitiva: remove comentários, auditorias, execuções, bugs e evidências produzidos por ele; atribuições restantes ficam sem responsável. Nunca permitir autoexclusão da sessão atual.

## Critérios de aceite para mudanças

- A ação principal deve estar acessível sem navegar para outra tela.
- Estados condicionais devem aparecer somente quando necessários.
- Ações de tabela precisam exibir feedback de sucesso ou erro.
- Filtros devem funcionar em conjunto e ser processados pela API quando afetarem paginação.
- Duplicação cria novo código e não copia execuções ou bugs.
- Exclusão remove o caso e todos os registros dependentes; sempre exigir confirmação na interface.
- Exportações devem respeitar os filtros recebidos.

Consulte também `docs/ARCHITECTURE.md`, `docs/PRODUCT.md` e `README.md`.
