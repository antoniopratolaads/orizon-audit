# Deploy ORIZON Audit Suite — DigitalOcean Droplet

Guida operativa per deploiare l'app su un droplet Ubuntu. Stack:

- **Docker** + Docker Compose (gestiscono app + nginx)
- **Next.js** (app) in container, **SQLite** persistente su volume Docker
- **nginx** front-facing su porta 80 con **Basic Auth**

---

## Quick deploy (droplet Ubuntu fresco)

1. Accedi al droplet tramite la **Console web di DigitalOcean** (Droplet → Access → Launch Droplet Console) oppure SSH.
2. Incolla questi 2 comandi (sostituisci `<URL-REPO>` con l'URL clone del tuo repo GitHub):

   ```bash
   export REPO_URL="https://github.com/<user>/<repo>.git"
   bash <(curl -fsSL "https://raw.githubusercontent.com/<user>/<repo>/main/deploy/bootstrap.sh")
   ```

3. Attendi 2-4 minuti (build del container). Alla fine lo script stampa le credenziali Basic Auth generate in automatico.
4. Apri `http://<IP-DROPLET>/` e inserisci user/password.

Le credenziali sono salvate anche in `/opt/orizon/deploy/CREDENTIALS.txt` sul droplet.

---

## Aggiornamenti (dopo il primo deploy)

Quando pushi nuove modifiche su GitHub:

```bash
cd /opt/orizon
git pull
docker compose build app
docker compose up -d app
```

Lo script `bootstrap.sh` è idempotente: puoi rilanciarlo senza problemi e fa le stesse cose.

---

## Modificare la password Basic Auth

```bash
cd /opt/orizon
htpasswd -B deploy/.htpasswd orizon
docker compose restart nginx
```

---

## Configurare la API key Claude

Due modi:

- **Raccomandato**: apri l'app in browser → Settings → incolla la chiave e salva. La chiave finisce in SQLite e sopravvive ai restart.
- **Fallback globale** (se vuoi che funzioni senza settare in UI):
  ```bash
  cd /opt/orizon
  echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
  docker compose up -d --force-recreate app
  ```

---

## Backup dati

Il DB SQLite vive nel volume Docker `orizon_data`. Per un backup:

```bash
docker run --rm -v orizon_data:/data -v /tmp:/backup alpine \
  tar czf /backup/orizon-$(date +%F).tar.gz -C /data .
```

Il file di backup esce in `/tmp/orizon-<data>.tar.gz` sul droplet.

---

## Log

```bash
# app
docker compose logs -f app
# nginx
docker compose logs -f nginx
```

---

## Porta / SSL

Di default nginx serve su `:80` HTTP senza SSL. Se vuoi HTTPS:

- Collega un dominio al droplet (record A verso l'IP)
- Modifica `deploy/nginx.conf` aggiungendo `server_name <dominio>`
- Installa `certbot` sul droplet: `apt install certbot python3-certbot-nginx`
- Lancia `certbot --nginx` per generare il certificato Let's Encrypt

Per accesso pubblico-ready consiglio di fare questo passaggio o di mettere il droplet dietro Cloudflare.

---

## Troubleshooting

- **"Permission denied" su docker**: stai come `root` (non `ubuntu`)
- **Build lenta**: prima build ~2-4 min (npm ci + Next build). Le successive usano cache
- **"Port 80 already in use"**: qualcosa serve già su 80. Ferma `apache2`/`nginx` di sistema: `systemctl stop nginx apache2`
- **L'app non risponde**: `docker compose logs app` per vedere errori Next/Prisma
