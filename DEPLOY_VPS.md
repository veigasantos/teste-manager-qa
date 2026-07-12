# Deploy em VPS Linux

Este guia publica o QA Manager sem Docker em uma VPS com Node.js 24, systemd e Nginx. A API Fastify serve a interface compilada, `/api/v1`, `/uploads` e `/health` no mesmo processo.

## 1. Preparar o servidor

Use uma distribuição Linux com suporte ativo. Instale Node.js 24, npm, Nginx e Certbot pelos repositórios adequados à distribuição. Crie um usuário de serviço sem privilégios administrativos:

```bash
sudo useradd --system --create-home --home-dir /opt/qa-manager --shell /usr/sbin/nologin qa-manager
sudo mkdir -p /opt/qa-manager /etc/qa-manager
sudo chown -R qa-manager:qa-manager /opt/qa-manager
```

O projeto deve ficar em `/opt/qa-manager`. Não publique o SQLite ou os uploads em uma pasta servida diretamente pelo Nginx.

## 2. Configurar o ambiente

Crie `/etc/qa-manager/qa-manager.env`, legível apenas por root:

```text
NODE_ENV=production
API_PORT=3333
HOST=127.0.0.1
WEB_ORIGIN=https://SEU_DOMINIO
SESSION_SECRET=SUBSTITUA_POR_64_CARACTERES_HEXADECIMAIS
DATABASE_URL=file:../data/qa-manager.db
UPLOAD_DIR=data/uploads
```

Gere o segredo com `openssl rand -hex 32` e proteja o arquivo:

```bash
sudo chown root:root /etc/qa-manager/qa-manager.env
sudo chmod 600 /etc/qa-manager/qa-manager.env
```

## 3. Instalar e compilar

Depois de copiar ou clonar o projeto para `/opt/qa-manager`:

```bash
cd /opt/qa-manager
sudo -u qa-manager npm ci
sudo -u qa-manager npm test
sudo -u qa-manager npm run build
sudo -u qa-manager npm run db:deploy
```

`db:deploy` aplica o schema sem criar o usuário administrador padrão. Para um banco totalmente novo, execute `npm run db:seed` uma única vez, altere imediatamente a senha do administrador pela interface e cadastre as demais pessoas em Configurações > Usuários e acessos.

## 4. Instalar o serviço

Copie `ops/systemd/qa-manager.service` para `/etc/systemd/system/qa-manager.service`. Confirme antes que `node` e `npm` estejam em `/usr/bin`; ajuste `Environment=PATH` e `ExecStart` se necessário.

```bash
sudo cp ops/systemd/qa-manager.service /etc/systemd/system/qa-manager.service
sudo systemctl daemon-reload
sudo systemctl enable --now qa-manager
sudo systemctl status qa-manager
curl --fail http://127.0.0.1:3333/health
```

Logs ficam no journal:

```bash
sudo journalctl -u qa-manager -n 100 --no-pager
sudo journalctl -u qa-manager -f
```

## 5. Configurar Nginx e HTTPS

Copie `ops/nginx/qa-manager.conf` para `/etc/nginx/sites-available/qa-manager`, substitua `SEU_DOMINIO` e habilite o site. A forma exata pode variar entre distribuições.

```bash
sudo ln -s /etc/nginx/sites-available/qa-manager /etc/nginx/sites-enabled/qa-manager
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d SEU_DOMINIO
```

Depois do HTTPS, valide `https://SEU_DOMINIO/health` e o login. A porta 3333 deve permanecer fechada no firewall externo.

## Atualizações

Antes de toda atualização:

```bash
cd /opt/qa-manager
sudo -u qa-manager npm run backup
```

Preserve sempre `apps/api/data`. Atualize apenas código e manifests, então execute:

```bash
sudo -u qa-manager npm ci
sudo -u qa-manager npm test
sudo -u qa-manager npm run build
sudo -u qa-manager npm run db:deploy
sudo systemctl restart qa-manager
curl --fail http://127.0.0.1:3333/health
```

Não execute o seed em atualizações. Se o health check falhar, consulte o journal antes de substituir ou restaurar qualquer dado.

## Backup e restauração

`npm run backup` copia o banco e os uploads para `apps/api/backups/<data>`. Transfira esses backups regularmente para outro servidor ou armazenamento. Uma cópia mantida apenas na mesma VPS não protege contra perda do disco.

Para restaurar, pare a aplicação e use:

```bash
sudo systemctl stop qa-manager
sudo -u qa-manager npm run restore -w @qa/api -- /caminho/do/backup
sudo systemctl start qa-manager
```

## Checklist

- DNS apontando para a VPS e HTTPS válido.
- `SESSION_SECRET` exclusivo e fora do repositório.
- API acessível externamente somente pelo Nginx.
- `apps/api/data` gravável apenas pelo usuário do serviço.
- Senha do administrador padrão (`admin@local.test`) alterada.
- Backup externo testado.
- Firewall liberando apenas SSH, HTTP e HTTPS.

