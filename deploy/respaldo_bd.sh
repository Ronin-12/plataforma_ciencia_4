#!/usr/bin/env bash
# Respaldo diario de la base de datos de Mupi.
#
# Guarda un archivo comprimido por día en /var/backups/mupi y borra los de más de 14 días.
# Un respaldo que solo vive en el mismo servidor NO protege si el servidor se pierde: copia esta
# carpeta fuera (Cloud Backup de IONOS, otro servidor o almacenamiento S3). Ver docs/despliegue_ionos.md.
#
# Programarlo (como el usuario postgres) con `sudo crontab -u postgres -e` y esta línea (3:15 a.m.):
#   15 3 * * * /opt/mupi/deploy/respaldo_bd.sh >> /var/log/mupi-respaldo.log 2>&1
#
# Restaurar un respaldo (¡reemplaza los datos actuales!):
#   gunzip -c /var/backups/mupi/murcielago_AAAA-MM-DD.sql.gz | psql -d murcielago

set -euo pipefail

BASE="${MUPI_BASE:-murcielago}"
DESTINO="${MUPI_RESPALDOS:-/var/backups/mupi}"
DIAS="${MUPI_DIAS_RESPALDO:-14}"
FECHA="$(date +%F)"
ARCHIVO="$DESTINO/${BASE}_${FECHA}.sql.gz"

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"   # contiene datos personales: solo su dueño puede leerlo

pg_dump --no-owner --no-privileges "$BASE" | gzip -9 > "$ARCHIVO.tmp"
mv "$ARCHIVO.tmp" "$ARCHIVO"
chmod 600 "$ARCHIVO"

# Comprobación rápida: un respaldo vacío o corrupto no sirve.
if ! gunzip -t "$ARCHIVO" || [ "$(stat -c %s "$ARCHIVO")" -lt 1000 ]; then
  echo "$(date -Is) ERROR: el respaldo $ARCHIVO parece dañado o vacío" >&2
  exit 1
fi

find "$DESTINO" -name "${BASE}_*.sql.gz" -mtime +"$DIAS" -delete
echo "$(date -Is) Respaldo listo: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"
