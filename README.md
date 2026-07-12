# QA Manager

Sistema para gestão de casos, ciclos, execuções e bugs de testes manuais — pensado para substituir a planilha de testes por algo mais rápido, mas com a mesma objetividade. Funciona sem Docker e sem depender de serviços externos.

Este documento tem duas partes:

1. **[Instalar no seu computador (localhost)](#1-instalar-no-seu-computador-localhost)** — para rodar localmente.

2. **[Publicar para outras pessoas acessarem (hospedagem)](#2-publicar-para-outras-pessoas-acessarem-hospedagem)** — quando quiser que outras pessoas usem pela internet, sem precisar do seu computador ligado.

Se você nunca instalou nada assim antes, siga os passos na ordem, sem pular nenhum. Cada passo explica o porquê, não só o comando.

---

## 1. Instalar no seu computador (localhost)

"Localhost" quer dizer que o sistema roda **dentro do seu próprio computador** — só quem estiver usando aquela máquina consegue acessar (ótimo para uma demonstração em uma reunião, por exemplo, com o computador conectado ao projetor).

### Passo 1 — Instalar o Node.js

O projeto é escrito em JavaScript/TypeScript e precisa do **Node.js** instalado para rodar (é o "motor" que executa o sistema).

1. Acesse **[nodejs.org](https://nodejs.org)**.
2. Baixe a versão **LTS** (é a recomendada, mais estável — vai estar em destaque na página).
3. Abra o instalador baixado e clique em "Avançar/Next" em todas as telas, aceitando as opções padrão.
4. Ao terminar, **reinicie o computador** (evita problemas de o Windows não reconhecer o comando `node` logo em seguida).

Esse passo só precisa ser feito **uma vez por computador**.

### Passo 2 — Conferir se instalou certo

1. Abra o **Terminal**: aperte a tecla Windows, digite `PowerShell` e tecle Enter.
2. Digite os dois comandos abaixo, um de cada vez, e aperte Enter depois de cada um:

   ```bash
   node -v
   npm -v
   ```

3. Cada comando deve responder com um número de versão (ex.: `v24.1.0`). Se aparecer algo como "node não é reconhecido...", o Node não foi instalado corretamente — repita o Passo 1 e reinicie o computador de novo.

O projeto precisa do **Node.js 20 ou mais novo** — foi testado com a versão 24.

### Passo 3 — Colocar os arquivos do projeto no computador

Copie a pasta inteira do projeto (`test-manager-qa`, com tudo dentro) para o computador onde vai rodar — por pen drive, rede da empresa, ou baixando de onde o projeto estiver hospedado (ex.: GitHub).

**Importante:** não é necessário (nem recomendado) copiar a pasta `node_modules`, caso ela já exista — ela é recriada automaticamente no Passo 5 e pode ser bem pesada.

### Passo 4 — Abrir o terminal dentro da pasta do projeto

1. Abra o Explorador de Arquivos do Windows e entre na pasta do projeto (ex.: `test-manager-qa`).
2. Clique em cima do caminho da pasta, na barrinha de endereço lá em cima, apague o texto e digite `powershell`, depois tecle Enter.
3. Uma janela de terminal vai abrir já "dentro" da pasta certa — é importante que todos os comandos dos próximos passos sejam digitados nessa mesma janela.

### Passo 5 — Instalar tudo e preparar o banco de dados (só na primeira vez)

Com o terminal aberto na pasta do projeto, rode:

```bash
npm run setup
```

Isso faz três coisas automaticamente, sem precisar de nada manual:

- Baixa da internet todas as "peças" (bibliotecas) que o sistema usa por baixo dos panos.
- Cria o banco de dados local do zero (um arquivo só, sem precisar instalar nenhum programa de banco de dados separado).
- Cadastra usuários e dados de exemplo, para você já entrar num sistema com conteúdo.

Esse comando pode demorar alguns minutos, dependendo da internet — é normal ver bastante texto passando na tela. Ele **só precisa ser rodado uma vez** (nas próximas vezes, use o Passo 6 diretamente).

Se a internet cair no meio ou der algum erro, pode rodar `npm run setup` de novo sem medo — ele não apaga nem duplica nada que já foi criado.

### Passo 6 — Iniciar o sistema

Ainda no mesmo terminal:

```bash
npm run dev
```

O terminal vai ficar "ocupado" mostrando mensagens — isso é esperado, é o sistema rodando. **Não feche essa janela** enquanto estiver usando o QA Manager; ela é o "motor" ligado.

### Passo 7 — Acessar pelo navegador

Abra o navegador (Chrome, Edge, etc.) e acesse:

```
http://localhost:5173
```

Você verá a tela de login. Entre com o usuário administrador:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@local.test | demo123 |

Depois de entrar, use **Configurações > Usuários e acessos** para cadastrar as pessoas reais que vão usar o sistema (QA, Desenvolvedor, Gestor), cada uma com seu próprio e-mail e permissões — não é mais necessário usar contas de demonstração para isso.

O sistema funciona **sem internet** depois de instalado (só precisa de internet no Passo 5, para baixar as peças na primeira vez).

### Passo 8 — Como parar o sistema

Clique dentro da janela do terminal que ficou rodando (a do Passo 6) e aperte `Ctrl + C`. Para usar de novo depois, basta repetir o Passo 6 (`npm run dev`) — não precisa repetir o Passo 5.

### Problemas comuns

| O que aparece | O que provavelmente é | O que fazer |
|---|---|---|
| `node não é reconhecido como um comando` | Node.js não instalado ou terminal aberto antes de reiniciar o PC | Refaça o Passo 1 e reinicie o computador |
| A página não abre em `localhost:5173` | O terminal do Passo 6 foi fechado, ou ainda está carregando | Confira se a janela do terminal ainda está aberta; espere alguns segundos após rodar `npm run dev` |
| Erro mencionando `EPERM` durante `npm run setup` | Alguma janela anterior do sistema ainda está rodando e "travando" um arquivo | Feche todas as janelas de terminal abertas do projeto e rode o comando de novo |
| Erro de política de segurança / antivírus corporativo bloqueando algo | Comum em computadores de empresa com políticas restritivas (ex.: Windows Defender Application Control) | O projeto já foi montado para evitar a maioria desses bloqueios; se acontecer, chame o time de TI/infra informando qual arquivo foi bloqueado |
| Mensagem sobre porta `5173` ou `3333` já em uso | Já existe outro `npm run dev` rodando em outra janela | Feche a janela de terminal anterior antes de abrir uma nova |

---

## 2. Publicar para outras pessoas acessarem (hospedagem)

### Duas formas de fazer isso

- **Opção A — Servidor próprio, barato** (ex.: um VPS da Hostinger ou similar): você mesmo contrata e instala, seguindo o guia técnico completo em **[DEPLOY_VPS.md](./DEPLOY_VPS.md)**, que já tem todos os comandos prontos para copiar e colar.
- **Opção B — Servidor da empresa** (ex.: AWS, se o time de desenvolvedores topar hospedar): o mesmo guia **[DEPLOY_VPS.md](./DEPLOY_VPS.md)** funciona, porque ele não depende de nenhum serviço específico — só precisa de um servidor Linux comum com Node.js instalado.

### Ideia geral do que acontece (em palavras simples)

1. Contrata-se ou libera-se um servidor Linux (uma "máquina" que fica ligada 24 horas, com um endereço de internet).
2. O projeto é copiado para dentro desse servidor (parecido com o Passo 3 do capítulo 1, só que em vez do seu computador, é o servidor).
3. Instala-se o Node.js nesse servidor (igual ao Passo 1, mas para Linux).
4. Configura-se um "endereço" (domínio, tipo `qa.suaempresa.com`) e um certificado de segurança (HTTPS) — isso é o que faz o navegador mostrar o cadeado de "site seguro".
5. O sistema é configurado para iniciar sozinho sempre que o servidor ligar (para não depender de alguém rodando `npm run dev` manualmente).

Cada um desses pontos, com os comandos exatos, está detalhado passo a passo em **[DEPLOY_VPS.md](./DEPLOY_VPS.md)**.

### O que NÃO muda entre localhost e hospedagem

- As telas, os dados cadastrados e o jeito de usar o sistema são exatamente os mesmos.
- O banco de dados continua sendo um arquivo simples (SQLite) — não é necessário instalar um banco de dados separado nem em produção.
- A senha do administrador (tabela do Passo 7) deve ser trocada assim que o sistema for usado por pessoas de verdade — isso está no checklist do `DEPLOY_VPS.md`.

---

## Comandos do dia a dia

Depois da primeira instalação (Passo 5), estes são os comandos mais usados, todos rodados de dentro da pasta do projeto:

- `npm run dev` — inicia o sistema para uso local (interface + API).
- `npm run build` — verifica se está tudo certo e gera a versão "compilada" (usada em produção).
- `npm start` — inicia a versão compilada; precisa rodar `npm run build` antes.
- `npm test` — confere se o código está sem erros de tipo.
- `npm run test:e2e` — roda os testes automatizados (Playwright) simulando um uso real do sistema.
- `npm run db:deploy` — aplica o formato mais recente do banco de dados, sem apagar nada.
- `npm run db:seed` — recria/atualiza os dados de demonstração sem apagar o que já existe.
- `npm run backup` — copia o banco de dados e as evidências para `apps/api/backups/<data>`.
- `npm run restore -w @qa/api -- <pasta>` — restaura um backup feito anteriormente.

## Funcionalidades

- Login local, sessões protegidas e perfis Administrador, QA, Desenvolvedor e Gestor.
- Dashboard por ciclo com aprovação, pendências, falhas, bloqueios e bugs.
- Casos reutilizáveis, filtros, paginação, duplicação e execução rápida.
- Registro condicional de bugs, status controlados, comentários, evidências e auditoria.
- Cadastros de ciclos, módulos e tipos de teste.
- Exportação XLSX e PDF respeitando os filtros enviados à API.
- Importação XLSX em duas etapas (`/api/v1/import/preview` e `/api/v1/import/commit`).
- Backup e restauração local.

## Configuração

Copie `.env.example` para `.env` se desejar mudar portas, origem web, chave de sessão ou pasta de uploads. Para uma apresentação local, os valores padrão já funcionam — não é necessário editar nada.

## Onde ficam os dados

O banco fica em `apps/api/data/qa-manager.db`; evidências ficam em `apps/api/data/uploads`. Esses dados não são versionados (não vão junto se você copiar só o código do projeto) — use `npm run backup` para guardar uma cópia de segurança antes de mover o projeto entre computadores.

## Quer entender mais a fundo?

- **[docs/PRODUCT.md](./docs/PRODUCT.md)** — como o sistema é pensado para o dia a dia de quem testa.
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — como as peças técnicas se conectam.
- **[DEPLOY_VPS.md](./DEPLOY_VPS.md)** — guia completo de publicação em servidor.
