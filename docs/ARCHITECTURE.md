# Arquitetura técnica

## Componentes

```text
React/Webpack :5173 → REST /api/v1 → Fastify :3333 → Prisma → SQLite
                                      └────→ data/uploads
```

Em produção, Nginx encerra HTTPS e encaminha as requisições para o Fastify em `127.0.0.1:3333`; o servidor de desenvolvimento Webpack não participa do ambiente publicado.

O frontend envia cookies com `credentials: include`. A API usa JWT armazenado em cookie HTTP-only e restringe CORS à origem configurada.

## Dados centrais

- Project: projeto inicial único (`default-project`).
- User: credenciais, vínculo com perfil e estado ativo.
- AccessProfile: nome, papel-base compatível e permissões JSON usadas na autorização.
- Module e TestType: cadastros configuráveis.
- Cycle: agrupador das execuções.
- TestCase: cenário, passos JSON, resultado esperado, prioridade e data.
- TestTemplate: modelos reutilizáveis centralizados para criação rápida de testes.
- Execution: resultado independente por ciclo.
- Bug: relação 1:1 opcional com execução.
- Comment, Evidence e AuditLog: colaboração e rastreabilidade.

O schema está em `apps/api/prisma/schema.prisma`. Alterações devem ser aplicadas com `npm run db:setup -w @qa/api` durante esta fase local.

## API

Prefixo: `/api/v1`.

- `/auth`: login, logout e sessão.
- `/cases`: consulta paginada, CRUD lógico e duplicação.
- `/cases/quick`: cria caso, execução e bug em transação.
- `/executions`: cria ou atualiza o resultado por ciclo.
- `/bugs`: lista, filtra, comenta e altera status.
- `/meta`: ciclos, módulos, tipos e usuários ativos.
- `/dashboard`: métricas agregadas.
- `/exports`: PDF e XLSX.
- `/import`: pré-visualização e confirmação de XLSX.
- `/evidences`: upload local.

Erros seguem `{ "error": { "code", "message", "details?" } }`.

## Persistência e produção

O SQLite e os uploads são ignorados pelo Git. Em uma VPS, `apps/api/data` deve permanecer fora do ciclo de substituição de releases e entrar na rotina de backup. SQLite atende ao uso atual de baixa concorrência; uma migração para PostgreSQL deve ser avaliada se o volume ou o número de gravações simultâneas crescer. A API continua sendo a única camada que acessa a persistência.

## Segurança

- Senhas com bcrypt.
- Cookie HTTP-only, SameSite Lax e expiração de oito horas.
- Em produção: HTTPS no proxy reverso, cookie `secure` e segredo de sessão forte fora do repositório.
- A API recusa inicialização em produção quando `SESSION_SECRET` não foi configurado.
- Uploads são limitados a 20 MB e restritos por uma lista de MIME types e extensões permitidas (imagem, PDF, vídeo); arquivos servidos em `/uploads` recebem `X-Content-Type-Options: nosniff`.
- `/auth/login` tem rate limiting (10 tentativas por minuto por IP, via `@fastify/rate-limit`) contra força bruta.
