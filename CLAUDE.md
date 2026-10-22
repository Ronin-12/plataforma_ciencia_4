# Plataforma educativa interactiva de Ciencias Naturales, 4.º grado

Piloto del Equipo Murciélago (UNITEC, ingeniería en sistemas). Scrum, 10 semanas.
El docente genera juegos con IA (Gemini); los alumnos de 4.º de primaria los juegan; el docente ve métricas del grupo.
Responde y documenta SIEMPRE en español. El usuario es estudiante: explica el porqué de cada cambio y avanza paso a paso.

## Stack
- Backend: FastAPI 0.115, asyncpg directo (sin ORM), bcrypt, PyJWT, pydantic-settings, google-genai.
- Frontend: React 19, Vite, Tailwind 4, framer-motion.
- BD: PostgreSQL 16. Esquema base `db/schema_v2.sql` + migraciones idempotentes en `db/migraciones/` (001 seguridad, 002 resultados).
- Windows: el backend se arranca con `python run.py` (no con `uvicorn` directo), desde `backend/` con el venv activo.

## Comandos
- Backend: `cd backend; python run.py` (API en http://127.0.0.1:8000, docs en `/docs`).
- Frontend: `cd frontend; npm run dev` (http://localhost:5173).
- Migración: `& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d murcielago -f db\migraciones\00X_nombre.sql`
- Pruebas: necesitan una BD DESECHABLE (se vacían sus tablas). Con las migraciones aplicadas:
  `$env:TEST_DATABASE_URL = "postgresql://postgres:CLAVE@127.0.0.1:5432/murcielago_test"; cd backend; pytest`
  Nunca apuntes TEST_DATABASE_URL a `murcielago`.
- Lint frontend: `cd frontend; npm run lint`.

## Reglas de trabajo
- Rama de trabajo: `arranque-local`. NUNCA hagas push a `main` del repo del equipo; los cambios van en ramas propias y PR.
- NUNCA leas, imprimas ni subas `backend/.env` ni claves (Gemini, SECRET_KEY, código de invitación). `.env` está en `.gitignore`.
- Todo cambio de esquema = migración nueva, numerada e idempotente, probada dos veces y con datos viejos. Nunca edites una migración ya aplicada.
- Toda función nueva lleva pruebas en `backend/tests/`. Antes de dar algo por terminado: `pytest` y `npm run lint` en verde.
- Commits pequeños y en español, un tema por commit.

## Arquitectura y decisiones clave
- Seguridad (`backend/app/core/`): JWT con `rol`, `iat`, `exp`, `sub` obligatorios; `deps.py` revalida el rol contra la BD en cada petición. El id del docente/alumno sale SIEMPRE del token, nunca del cliente.
- Registro de docentes con código de invitación (`CODIGO_INVITACION_DOCENTES`).
- Alumnos: login = código de aula → elegir nombre → PIN (bcrypt `pin_hash`; el PIN se muestra una sola vez; "Nuevo PIN" lo restablece). Bloqueo tras 5 fallos por 5 min, guardado en PostgreSQL. Limitadores por IP en memoria (solo sirven con un proceso).
- Resultados (`routers/resultados.py`): `registro_avances.id_juego` → `juegos_generados`. Puntuación = % de aciertos calculado en el navegador. Puntos = suma por juego de round(mejor%/10) (10 por juego perfecto; repetir no infla). Límite 60 resultados/hora/alumno.
- Métricas (`routers/metricas.py`): `UMBRAL_APOYO = 60`; devuelve resumen, por juego y por alumno.
- IA (`routers/ia.py`): reintenta con retroalimentación, recorta excesos, cambia de modelo con 403/404/429/5xx, registra el motivo en el log. Modelos configurables en `.env`.
- Trampa conocida: un 500 sin manejar sale por fuera de CORSMiddleware y el navegador lo muestra como "No se pudo conectar con el servidor". Antes de culpar a la red, revisa la terminal del backend.

## Requisitos del proyecto que NO se deben romper
- RNF-02: contraseñas con bcrypt, roles separados.
- RNF-03: derecho ARCO, poder borrar los datos de un alumno.
- RNF-04: a la IA NUNCA se le envían nombres de alumnos.
- RNF-08: el proveedor de IA debe poder cambiarse (no acoplar el código a Gemini).
- Un humano (docente) aprueba el contenido de la IA antes de que lo vean los niños.
- Interfaz para niños de 4.º: lenguaje simple, botones grandes, accesible.

## Pendiente (en este orden sugerido)
1. Manejo de errores: que un 500 responda JSON con CORS y la interfaz diga "error del servidor", no "API apagada". Chequeo al arrancar que avise si falta una migración.
2. Flujo de aprobación del docente: el juego generado queda en borrador y el alumno solo ve los aprobados (human-in-the-loop).
3. Capa de proveedor de IA intercambiable (RNF-08): Gemini + modo demo sin clave (+ opcional otro proveedor).
4. Borrado de alumno y sus datos (RNF-03).
5. Subida de archivos como contexto para generar juegos (RF-08).
6. Métricas para administrador (RF-09).
7. Calidad: revisar `npm audit`, GitHub Actions con pytest + lint, README y CONTRIBUTING, guardar el campo "Escuela" (hoy no se guarda), limitadores compartidos si hay más de un proceso.
8. Entrega: PR a la rama del equipo con descripción de cada sprint.

## Cómo trabajar un pendiente
Lee primero los archivos implicados, propón el plan en pocas líneas, implementa con pruebas, corre `pytest` y lint, y resume qué cambió y qué debe hacer el usuario (migraciones, reinicios).
