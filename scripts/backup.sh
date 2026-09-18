#!/bin/sh
# Cópia de segurança: a base de dados e as imagens carregadas.
#
# Assim que houver contas de outras pessoas, isto deixa de ser opcional. São
# as duas únicas coisas que não se podem reconstruir a partir do repositório.
#
# Correr na máquina de produção, a partir da pasta do projeto:
#   ./scripts/backup.sh /caminho/para/as/copias
#
# Numa tarefa do cron, todas as noites às 3h:
#   0 3 * * * cd /opt/chef-xp && ./scripts/backup.sh /var/backups/chef-xp
#
# Guardar as cópias na mesma máquina protege de um `DROP TABLE` distraído, não
# de a máquina arder. Vale a pena levá-las para outro sítio.

set -eu

DESTINO="${1:-./backups}"
DIAS_A_GUARDAR="${DIAS_A_GUARDAR:-14}"
CARIMBO="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$DESTINO"

# A base. `--clean` para o restauro não exigir uma base vazia de propósito.
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-chef}" --clean --if-exists "${POSTGRES_DB:-chef_xp}" \
  | gzip > "$DESTINO/base_$CARIMBO.sql.gz"

# As imagens. Vivem num volume do Docker, e é de lá que se tiram.
docker run --rm \
  -v chef-xp-foundation_chef_xp_uploads:/uploads:ro \
  -v "$(cd "$DESTINO" && pwd)":/destino \
  alpine tar czf "/destino/uploads_$CARIMBO.tar.gz" -C /uploads .

# Apagar as antigas. Sem isto, o disco enche-se e o servidor pára — de uma
# maneira que ninguém relaciona com cópias de segurança.
find "$DESTINO" -name 'base_*.sql.gz'    -mtime "+$DIAS_A_GUARDAR" -delete
find "$DESTINO" -name 'uploads_*.tar.gz' -mtime "+$DIAS_A_GUARDAR" -delete

echo "[backup] $CARIMBO guardado em $DESTINO"
ls -lh "$DESTINO" | tail -n 4
