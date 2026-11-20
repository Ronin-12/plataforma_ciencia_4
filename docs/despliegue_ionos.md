# Publicar Mupi en un VPS de IONOS

Guía paso a paso para poner Mupi en internet con HTTPS. Todo corre en **un solo servidor**:
nginx (la página y el HTTPS), la API (FastAPI) y PostgreSQL. Para el piloto alcanza un VPS con
4 GB de RAM y Ubuntu 24.04.

```
Navegador ──HTTPS──> nginx ──> /          archivos de la página (frontend/dist)
                          └──> /api/...  API en 127.0.0.1:8000 ──> PostgreSQL (solo local)
```

> Antes de publicar, revisa la lista «Antes de abrir al público» al final.

## 1. Preparar el servidor

1. En el panel de IONOS crea el VPS con **Ubuntu 24.04**. Elige el centro de datos de **Estados Unidos**
   (no hay en México) y anota la IP pública.
2. En tu dominio crea dos registros **A** apuntando a esa IP: `@` y `www`.
3. En el firewall del panel de IONOS deja abiertos solo los puertos **22, 80 y 443**. PostgreSQL (5432)
   NUNCA se abre a internet.
4. Entra por SSH y prepara el sistema:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql python3-venv python3-pip git certbot python3-certbot-nginx unattended-upgrades
sudo adduser --system --group --home /opt/mupi mupi
```

Node.js (para compilar la página) se instala con:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

## 2. Base de datos

```bash
sudo -u postgres psql -c "CREATE USER mupi WITH PASSWORD 'UNA_CONTRASEÑA_LARGA';"
sudo -u postgres psql -c "CREATE DATABASE murcielago OWNER mupi;"
```

Copia el proyecto a `/opt/mupi` (con `git clone` o subiendo una copia) y aplica el esquema y **todas**
las migraciones, en orden:

```bash
cd /opt/mupi
sudo -u postgres psql -d murcielago -v ON_ERROR_STOP=1 -f db/schema_v2.sql
for f in $(ls db/migraciones/*.sql | sort); do sudo -u postgres psql -d murcielago -v ON_ERROR_STOP=1 -f "$f"; done
sudo -u postgres psql -d murcielago -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO mupi; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mupi;"
```

Para pasar los datos de la base local, haz un respaldo en tu computadora y restáuralo aquí
(ver «Respaldos»). Si empiezas de cero, no hace falta.

## 3. API

```bash
cd /opt/mupi/backend
sudo -u mupi python3 -m venv venv
sudo -u mupi venv/bin/pip install -r requirements.txt
sudo -u mupi cp .env.example .env && sudo chmod 600 .env
sudo -u mupi nano .env
```

Valores de producción en `.env` (los demás pueden quedarse como vienen):

| Variable | Valor en producción |
|---|---|
| `DATABASE_URL` | `postgresql://mupi:UNA_CONTRASEÑA_LARGA@127.0.0.1:5432/murcielago` |
| `SECRET_KEY` | Una NUEVA: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`. Nunca la de tu computadora. |
| `CODIGO_INVITACION_DOCENTES` | Un código largo que solo entregan ustedes |
| `GEMINI_API_KEY` | Clave de un proyecto con **facturación activada** (plan de pago: Google no usa los datos para entrenar) |
| `CORS_ORIGENES` | `https://TU_DOMINIO,https://www.TU_DOMINIO` |
| `CONFIAR_EN_PROXY` | `true` |
| `URL_FRONTEND` | `https://TU_DOMINIO` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`, `SMTP_PASSWORD`, `SMTP_REMITENTE` | Los datos del buzón que enviará los correos (por ejemplo `no-responder@TU_DOMINIO`) |

Instala el servicio para que la API arranque sola y se reinicie si falla:

```bash
sudo cp /opt/mupi/deploy/mupi-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now mupi-api
sudo systemctl status mupi-api        # debe decir "active (running)"
curl http://127.0.0.1:8000/health    # debe responder "conectada"
```

Si no arranca, `sudo journalctl -u mupi-api -n 50` muestra el motivo (por ejemplo, una migración faltante).

## 4. Página (frontend)

La página llama a la API en `https://TU_DOMINIO/api`. Esa dirección se fija al compilar:

```bash
cd /opt/mupi/frontend
echo "VITE_API_URL=https://TU_DOMINIO/api" | sudo -u mupi tee .env.production
sudo -u mupi npm ci && sudo -u mupi npm run build     # crea frontend/dist
```

## 5. nginx y HTTPS

```bash
sudo cp /opt/mupi/deploy/nginx-mupi.conf /etc/nginx/sites-available/mupi
sudo sed -i 's/TU_DOMINIO/tudominio.mx/g' /etc/nginx/sites-available/mupi
sudo ln -s /etc/nginx/sites-available/mupi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tudominio.mx -d www.tudominio.mx --redirect
```

certbot obtiene el certificado gratuito, activa HTTPS, redirige todo lo que llegue por `http://` y lo
renueva solo. Comprueba la renovación con `sudo certbot renew --dry-run`.

## 6. Cuenta de administrador

Regístrate en la página como docente y promuévela:

```bash
sudo -u postgres psql -d murcielago -c "UPDATE docentes SET rol = 'administrador' WHERE email = 'tu-correo@dominio.mx';"
```

## 7. Respaldos

```bash
sudo cp /opt/mupi/deploy/respaldo_bd.sh /usr/local/bin/ && sudo chmod 755 /usr/local/bin/respaldo_bd.sh
sudo crontab -u postgres -e
# agrega esta línea (todos los días a las 3:15 a.m.):
15 3 * * * /usr/local/bin/respaldo_bd.sh >> /var/log/mupi-respaldo.log 2>&1
```

Crea el archivo de log una vez: `sudo touch /var/log/mupi-respaldo.log && sudo chown postgres /var/log/mupi-respaldo.log`.

**Un respaldo en el mismo servidor no basta.** Copia `/var/backups/mupi` fuera de él: activa el
Cloud Backup de IONOS para el VPS, o súbelo a otro almacenamiento. **Prueba restaurar** al menos una
vez en una base de prueba: un respaldo que nunca se restauró no está comprobado.

## 8. Actualizar a una versión nueva

```bash
cd /opt/mupi && sudo -u mupi git pull
# 1) aplica las migraciones NUEVAS (la API no arranca si falta alguna y dice cuál) y repite el
#    GRANT del paso 2 para que el usuario mupi pueda usar las tablas nuevas
# 2) dependencias y página
sudo -u mupi backend/venv/bin/pip install -r backend/requirements.txt
cd frontend && sudo -u mupi npm ci && sudo -u mupi npm run build
sudo systemctl restart mupi-api
```

Haz un respaldo manual (`sudo -u postgres /usr/local/bin/respaldo_bd.sh`) ANTES de cada migración.

## Antes de abrir al público

- [ ] HTTPS activo y `http://` redirige a `https://`.
- [ ] `.env` de producción con `SECRET_KEY` nueva, `CORS_ORIGENES`, `URL_FRONTEND`, SMTP y `CONFIAR_EN_PROXY=true`.
- [ ] Gemini en plan de pago y con un límite de gasto configurado en Google.
- [ ] «¿Olvidaste tu contraseña?» probado de punta a punta (el correo llega y el enlace funciona).
- [ ] Respaldo diario funcionando, copiado fuera del servidor y restaurado una vez como prueba.
- [ ] Aviso de privacidad, términos y aviso para familias revisados por un asesor y con los datos
      reales del responsable (ver `frontend/src/components/legal/`).
- [ ] Puertos 5432 y 8000 cerrados hacia internet (solo 22, 80 y 443 abiertos).
- [ ] Actualizaciones automáticas de seguridad: `sudo dpkg-reconfigure -plow unattended-upgrades`.
