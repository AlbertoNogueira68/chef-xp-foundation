#!/bin/sh
# Deploy em produção: traz o main e reconstrói a app.
#
# Corre no servidor. É o que o GitHub Actions chama depois de o CI passar, e
# é também o que se corre à mão:
#   ssh root@servidor /opt/chef-xp/scripts/deploy.sh
#
# A chave do GitHub está presa a este guião no authorized_keys
# (`command="..."`): quem a tiver consegue fazer deploy e mais nada — nem
# shell, nem túneis, nem ler o .env.prod.

set -eu

cd "$(dirname "$0")/.."

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"

# Um deploy de cada vez. Dois pushes seguidos não podem estar os dois a meio
# de um `git reset` e de um build ao mesmo tempo.
exec 9>/tmp/chef-xp-deploy.lock
flock 9

echo "[deploy] antes: $(git log --oneline -1)"

# `reset --hard` e não `pull`: o servidor não tem alterações próprias a
# guardar, e um pull que parasse num conflito deixava o deploy a meio.
git fetch --quiet origin main
git reset --quiet --hard origin/main
echo "[deploy] agora: $(git log --oneline -1)"

$COMPOSE up -d --build --remove-orphans

# O compose dá o contentor por arrancado antes de a app responder. Só é um
# deploy bem-sucedido quando o health check responde através do Caddy.
DOMINIO="$(grep '^SITE_DOMAIN=' .env.prod | cut -d= -f2-)"
for i in $(seq 1 60); do
  if curl -fsS -m 5 "https://$DOMINIO/api/health" > /dev/null 2>&1; then
    echo "[deploy] https://$DOMINIO a responder"
    # Cada build deixa a imagem anterior para trás; sem isto o disco enche.
    docker image prune -f > /dev/null
    exit 0
  fi
  sleep 2
done

echo "[deploy] a app não respondeu em 2 minutos. Últimas linhas:"
$COMPOSE logs --tail 40 app
exit 1
