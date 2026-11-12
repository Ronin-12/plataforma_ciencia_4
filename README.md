# 🦇 Plataforma Educativa de Ciencias Naturales — 4.º Grado

Piloto funcional de una plataforma web interactiva para que alumnos de 4.º grado aprendan Ciencias Naturales mediante actividades gamificadas, con un asistente de IA que apoya al docente en la planeación y el seguimiento del grupo.

**Equipo Murciélago** · Fecha de inicio: 28 de septiembre de 2026 · Duración: 10 semanas

---

## 🎯 Objetivo del piloto

Desarrollar en 10 semanas un piloto funcional que incluya:

- ✅ 3 actividades interactivas de Ciencias Naturales
- ✅ Panel docente con métricas del grupo
- ✅ Asistente de IA para planeación (modelo Human-in-the-loop)
- ✅ Acceso por roles: alumno, docente, administrador
- ✅ Publicación en línea con HTTPS

## Iniciar el backend local en Windows

1. Instala e inicia PostgreSQL 16. Crea una base llamada `murcielago` si aún no existe.
2. Inicializa el esquema o actualiza una base existente. Desde la raíz del repositorio, para una base nueva ejecuta el esquema y después las cinco migraciones:

   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/schema_v2.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/001_seguridad.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/002_resultados.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/003_escuela.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/004_aprobacion.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/005_tablas_ia.sql
   ```

   Para una base que ya tiene las tablas del proyecto, ejecuta solo las migraciones que falten (`001`, `002`, `003`, `004`, `005`). Si olvidas alguna, la API no arranca y te dice cuál falta. No vuelvas a ejecutar `schema_v2.sql`, porque crea las tablas base.
3. Abre PowerShell en `backend` y crea/activa el entorno virtual e instala dependencias:

   ```powershell
   py -3.13 -m venv venv
   .\venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

4. Si todavía no existe `backend\.env`, créalo desde el ejemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Valida y guarda la contraseña que PostgreSQL realmente acepta para el usuario `postgres`. El programa la solicita de forma oculta, prueba la conexión con `asyncpg` y solo actualiza `DATABASE_URL` si la prueba funciona:

   ```powershell
   python configure_local_db.py
   ```

   El `.env` debe apuntar a `127.0.0.1:5432/murcielago`. No publiques el `.env` ni compartas la contraseña.

6. Inicia la API con el loop compatible con Windows:

   ```powershell
   python run.py
   ```

   La API queda en `http://127.0.0.1:8000`; la documentación está en `http://127.0.0.1:8000/docs`. `/health` prueba la conexión con PostgreSQL.

   Para generación de juegos, configura `GEMINI_API_KEY` en `backend\.env`. Para presentar el proyecto sin internet ni clave, pon `IA_PROVEEDOR=demo` en `backend\.env` y reinicia la API: se generan juegos y clases de ejemplo (marcados «demo») sin gastar créditos. La API intenta `gemini-3.8-flash`, `gemini-3.6-flash` y `gemini-3.5-flash-lite` en ese orden si recibe saturación. Puedes cambiar la secuencia con `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` y `GEMINI_LAST_RESORT_MODEL`.

   El panel docente permite analizar PDFs y fotos (hasta 10 archivos y 20 MB por análisis), convertir temas en sesiones y generar juegos asociados. Se requiere una clave Gemini válida. El backend crea las tablas nuevas al arrancar sin borrar la información existente.

   El plan local inicia con `IA_GENERACIONES_MENSUALES_MAX=15` créditos por docente y mes. Cada análisis de materiales y cada generación de juego consume un crédito; cambia el valor en `.env` para ajustar el límite. Es un contador de solicitudes de IA, no un recuento de tokens facturados por Google.

   Para permitir el registro de docentes, establece un valor privado para `CODIGO_INVITACION_DOCENTES` en `backend\.env`, y una `SECRET_KEY` propia (el `.env.example` explica cómo generarla). La persona que se registra debe ingresar ese mismo código. No publiques `.env`, claves Gemini, contraseñas ni códigos de invitación.

   **Cuenta de administrador.** No se crea desde la pantalla de registro. Regístrate como docente y luego promueve esa cuenta con una línea de SQL (pgAdmin o `psql`, sobre la base `murcielago`):

   ```sql
   UPDATE docentes SET rol = 'administrador' WHERE email = 'tu-correo@escuela.mx';
   ```

   Después inicia sesión con ese mismo correo (entra por «Soy Docente») y verás el panel de administración. Una cuenta de administrador deja de ser docente: usa otro correo para dar clases. Desde el panel no se puede desactivar a un administrador; si hace falta, se hace con SQL.

## Iniciar el frontend

En otra terminal, desde `frontend`:

```powershell
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`. Para revisar el código: `npm run lint`.

## Pruebas del backend

Las pruebas usan una base PostgreSQL **desechable** (se vacían sus tablas), nunca `murcielago`. Créala, aplícale `schema_v2.sql` y las migraciones, y córrelas desde `backend`:

```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE murcielago_test"
# aplica db\schema_v2.sql y db\migraciones\00*.sql a murcielago_test (como en el paso 2, cambiando -d murcielago por -d murcielago_test)
python -m pip install -r requirements-dev.txt
$env:TEST_DATABASE_URL = "postgresql://postgres:TU_CLAVE@127.0.0.1:5432/murcielago_test"
python -m pytest
```

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La API no arranca y dice «FALTAN MIGRACIONES» | Aplica las migraciones que lista, en orden, y reinicia |
| El navegador dice «Error del servidor» | La API falló: la causa completa está en la terminal donde corre `python run.py` |
| «No se pudo conectar con el servidor» | La API realmente está apagada o `VITE_API_URL` apunta a otra dirección |
| El botón de crear juego falla con 403 | Google rechazó la clave o el proyecto: revisa `GEMINI_API_KEY` |

Los parámetros de configuración y su significado están en `backend\.env.example`. Las reglas de trabajo del equipo están en `docs\gobernanza_equipo.md` y `CONTRIBUTING.md`.

---

## 📂 Estructura del repositorio

- `backend/`: API en FastAPI. Las rutas están en `app/routers`, la seguridad en `app/core`, el acceso a PostgreSQL en `app/db` y las pruebas en `tests`.
- `frontend/`: aplicación web en React y Vite (`src/components`, `src/services/api.js`).
- `db/`: esquema base (`schema_v2.sql`) y migraciones numeradas (`migraciones/`).
- `docs/`: documentación del equipo.
- `.github/workflows/ci.yml`: revisión automática en cada pull request (pruebas, lint y build).
