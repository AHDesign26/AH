# newAH

Flask + pypy3 backend for the AHDesign website, packaged with Docker Compose.

## Stack

- App: pypy3 running `bjoern_server.py` (Bjoern WSGI)
- Cache: Redis
- Container runtime: Docker / Docker Compose
- Reverse proxy / TLS: handled outside this repo (host nginx or similar)

## Repo layout

- `app.py` — Flask routes
- `bjoern_server.py` — WSGI entry point
- `docker-compose.yml` — service definitions (`backend`, `redis`)
- `Dockerfile` — backend image
- `.env` — runtime secrets (not committed)
- `templates/`, `static/` — site assets

## Local / server deploy

The compose stack uses `restart: unless-stopped`, so once Docker is running the containers come back on host reboot automatically. No systemd unit is required.

### First-time bring-up

```bash
cd /var/www/html/newAH
docker compose up -d
```

### Pulling new changes

```bash
cd /var/www/html/newAH
git pull
docker compose up -d
```

`docker compose up -d` is a no-op for unchanged services, so it's safe to run after every pull. It will recreate any service whose image, command, env, mounts, or compose-file definition has changed.

### Reloading after a `docker-compose.yml` change

A plain `restart` does not pick up changes to `ports`, `network_mode`, `volumes`, `env_file`, etc. — Docker has to recreate the container. Force it with:

```bash
cd /var/www/html/newAH
docker compose up -d --force-recreate backend
```

Replace `backend` with the service name you changed, or omit it to recreate everything.

### Reloading app code only

Code lives on a bind mount (`.:/app`), so Python source edits take effect on the next process start. Restart just the backend:

```bash
docker compose restart backend
```

### Verifying after a reload

```bash
docker ps --filter name=newah-backend
sudo ss -tulpn | grep :8080
curl -sI http://127.0.0.1:8080 | head -1
docker logs --tail 30 newah-backend-1
```

## Networking

The backend uses `network_mode: host`, so it binds port 8080 directly on the host's network namespace. Nothing else may be listening on 8080 — check with:

```bash
sudo ss -tulpn | grep :8080
```

If that shows a non-Docker process, stop it before bringing the stack up.

## Troubleshooting

### Find what's listening on port 8080

```bash
sudo ss -tulpnH 'sport = :8080'
```

### Map a listening PID back to its container

```bash
PID=$(sudo ss -tulpnH 'sport = :8080' | grep -oP 'pid=\K[0-9]+' | head -1)
sudo cat /proc/$PID/cgroup | head -1
```

A `/docker/<container-id>` cgroup means it's a container; pass that ID to `docker ps --filter id=<id>` and `docker inspect`.

### Logs

```bash
docker compose logs -f backend
docker compose logs -f redis
```

## Remotes

- `origin` → `https://github.com/AHDesign26/AH.git` (current)
- The legacy mirror `https://github.com/afif86/newAH.git` is no longer the deploy source.
