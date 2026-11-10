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
2. Inicializa el esquema o actualiza una base existente. Desde la raíz del repositorio, para una base nueva ejecuta el esquema y después ambas migraciones:

   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/schema_v2.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/001_seguridad.sql
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U postgres -d murcielago -f db/migraciones/002_resultados.sql
   ```

   Para una base que ya tiene las tablas del proyecto, ejecuta solo `001_seguridad.sql` y `002_resultados.sql`; no vuelvas a ejecutar `schema_v2.sql`, porque crea las tablas base.
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

   Para generación de juegos, configura `GEMINI_API_KEY` en `backend\.env`. La API intenta `gemini-3.8-flash`, `gemini-3.6-flash` y `gemini-3.5-flash-lite` en ese orden si recibe saturación. Puedes cambiar la secuencia con `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` y `GEMINI_LAST_RESORT_MODEL`.

   El panel docente permite analizar PDFs y fotos (hasta 10 archivos y 20 MB por análisis), convertir temas en sesiones y generar juegos asociados. Se requiere una clave Gemini válida. El backend crea las tablas nuevas al arrancar sin borrar la información existente.

   El plan local inicia con `IA_GENERACIONES_MENSUALES_MAX=15` créditos por docente y mes. Cada análisis de materiales y cada generación de juego consume un crédito; cambia el valor en `.env` para ajustar el límite. Es un contador de solicitudes de IA, no un recuento de tokens facturados por Google.

   Para permitir el registro de docentes, establece un valor privado para `CODIGO_INVITACION_DOCENTES` en `backend\.env`. La persona que se registra debe ingresar ese mismo código. No publiques `.env`, claves Gemini, contraseñas ni códigos de invitación.

---

## 📂 Estructura del repositorio
