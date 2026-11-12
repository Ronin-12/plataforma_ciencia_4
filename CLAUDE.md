# Plataforma educativa interactiva de Ciencias Naturales, 4.º grado

Piloto del Equipo Murciélago (UNITEC, ingeniería en sistemas). Scrum, 10 semanas.
El docente genera juegos con IA (Gemini); los alumnos de 4.º de primaria los juegan; el docente ve métricas del grupo.
Responde y documenta SIEMPRE en español. El usuario es estudiante: explica el porqué de cada cambio y avanza paso a paso.

## Stack
- Backend: FastAPI 0.115, asyncpg directo (sin ORM), bcrypt, PyJWT, pydantic-settings, google-genai.
- Frontend: React 19, Vite, Tailwind 4, framer-motion.
- BD: PostgreSQL 16. Esquema base `db/schema_v2.sql` + migraciones idempotentes en `db/migraciones/` (001 seguridad, 002 resultados, 003 escuela, 004 aprobación, 005 tablas de IA). Al arrancar, la API revisa que estén aplicadas y no inicia si falta alguna.
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
- Rama de trabajo: `aaron_emm`. NUNCA hagas push a `main` del repo del equipo; los cambios van en ramas propias y PR.
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
- Sesiones y materiales (colaboración de Ronin-12): el docente sube PDF/fotos (10 archivos, 20 MB), la IA propone temas, cada tema se guarda como sesión (`sesiones_docente`) y los juegos se generan con ese contexto. Rutas `/ia/uso`, `/ia/sesiones`, `/ia/materiales/analizar`: el docente sale del token, ninguna recibe su id. El tipo de archivo se decide por sus primeros bytes, no por la extensión; `core/subidas.py` corta las subidas enormes por Content-Length.
- Créditos de IA (`IA_GENERACIONES_MENSUALES_MAX`, 15 por docente y mes): cada análisis o juego reserva uno y `_credito_ia` lo devuelve si la IA no entrega nada o algo falla. Las tablas `sesiones_docente` e `ia_generaciones_mes` se crean al arrancar (`db/session.py`) y también están en `schema_v2.sql`; si se tocan, hacerlo con una migración.
- `prompt_original` guarda lo que escribió el docente, sin el material de la sesión.
- Trampa conocida: un 500 sin manejar sale por fuera de CORSMiddleware y el navegador lo muestra como "No se pudo conectar con el servidor". Antes de culpar a la red, revisa la terminal del backend.

## Requisitos del proyecto que NO se deben romper
- RNF-02: contraseñas con bcrypt, roles separados.
- RNF-03: derecho ARCO, poder borrar los datos de un alumno.
- RNF-04: a la IA NUNCA se le envían nombres de alumnos.
- RNF-08: el proveedor de IA debe poder cambiarse (no acoplar el código a Gemini).
- Un humano (docente) aprueba el contenido de la IA antes de que lo vean los niños.
- Interfaz para niños de 4.º: lenguaje simple, botones grandes, accesible.

## Pendiente (por sprints, en este orden)
Cada sprint termina en un PR al repo del equipo (nunca a `main`), con descripción de lo hecho.

**Sprint A: Estabilidad y errores. HECHO.** Protege lo que ya funciona.
- Un 500 responde JSON con CORS; el panel dice "Error del servidor", no "API apagada".
- Chequeo al arrancar: el backend avisa en la terminal si falta una migración y cuál aplicar.
- Guardar el campo "Escuela" (hoy no se guarda).
- README: pasos para levantar el proyecto desde cero.

**Sprint B: Aprobación del docente. HECHO.** `juegos_generados.estado` (borrador/aprobado/descartado, migración 004; los juegos anteriores quedaron aprobados). La IA crea borradores; `POST /ia/juegos/{id}/estado` aprueba/retira/descarta; `PUT /ia/juegos/{id}` edita (revalida y regresa a borrador); el alumno y `/resultados` solo ven aprobados; las métricas ignoran borradores sin intentos. Pantalla «Revisar juegos» en el panel docente.

**Sprint C: Clases interactivas desde el material del docente. HECHO.** `POST /ia/generar-clase` (sesión → clase de 3-5 secciones con explicación, ejemplo y mini-reto sin nota, más una evaluación final que es un juego normal y sí da puntos). Se guarda en `juegos_generados` con `tipo_actividad = "clase"` (sin migración), nace en borrador y usa el mismo flujo de aprobación, edición, resultados y métricas. El análisis de material guarda `contenido` (puntos clave) por tema para fundamentar la clase. Frontend: `VisorClase`, `VisorActividad`, edición de clases en `EditorJuego`.

**Sprint D: Proveedor de IA intercambiable. HECHO.** Paquete `backend/app/ia/`: `base.py` (interfaz `ProveedorIA`, `Solicitud`, `ErrorProveedor`), `gemini.py`, `demo.py` (`IA_PROVEEDOR=demo`, sin créditos), `privacidad.py` (RNF-04: el texto del docente que nombra a un alumno suyo se rechaza con 422; el material de la sesión se limpia cambiando el nombre por «un alumno»; solo cuenta el nombre con mayúscula inicial). Para añadir un proveedor: clase nueva + registrarla en `PROVEEDORES`. Limitación: los PDF/imágenes se envían tal cual, no se pueden revisar; la interfaz avisa al docente.

(Texto original del sprint, ya cumplido:)
- Gemini detrás de una interfaz (RNF-08).
- Modo demo sin clave con juegos de ejemplo (presentaciones, pruebas sin cuota).
- Opcional: otro proveedor.
- Verificar que a la IA nunca se le envían nombres de alumnos (RNF-04).

**Sprint E: Datos y privacidad. HECHO.** Derechos ARCO sobre alumnos en `routers/alumnos.py`: `GET /alumnos/{id}/datos` (Acceso), `PATCH /alumnos/{id}` (Rectificación del nombre y Oposición = desactivar; `activo` ya existía y corta el login, el token abierto y las métricas), `DELETE /alumnos/{id}` (Cancelación; los resultados se borran por ON DELETE CASCADE y se devuelve cuántos). Interfaz en `GestionAlumnos.jsx` (el borrado pide escribir el nombre). Migración 005 crea `sesiones_docente`, `ia_generaciones_mes` y `juegos_generados`; el arranque (`db/session.py`) ya no ejecuta DDL, solo comprueba el esquema. `npm audit fix` resolvió las 2 vulnerabilidades altas (dependencias de la herramienta `shadcn`, no del navegador); quedan 9 de severidad baja/moderada cuyo arreglo exige bajar de versión `eslint` o `shadcn`, así que se dejan.

**Sprint F: Funciones nuevas (resto del tiempo).**
- Subir archivos como contexto para generar juegos (RF-08): HECHO (sesiones y materiales). Falta avisar al docente que el material no debe traer nombres de alumnos (RNF-04).
- Métricas para administrador (RF-09).
- Métricas del docente con filtros por juego, alumno y fecha.
- Nuevos tipos de juego si el equipo los pide.

**Calidad (en paralelo).** GitHub Actions (`.github/workflows/ci.yml`: pytest con PostgreSQL, lint y build) ya existe; más pruebas del frontend; limitadores compartidos si hay más de un proceso; CONTRIBUTING.

## Cómo trabajar un pendiente
Lee primero los archivos implicados, propón el plan en pocas líneas, implementa con pruebas, corre `pytest` y lint, y resume qué cambió y qué debe hacer el usuario (migraciones, reinicios).
