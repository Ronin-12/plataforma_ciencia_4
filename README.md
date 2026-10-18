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
2. Abre PowerShell en `backend` y crea/activa el entorno virtual e instala dependencias:

   ```powershell
   py -3.13 -m venv venv
   .\venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

3. Si todavía no existe `backend\.env`, créalo desde el ejemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Valida y guarda la contraseña que PostgreSQL realmente acepta para el usuario `postgres`. El programa la solicita de forma oculta, prueba la conexión con `asyncpg` y solo actualiza `DATABASE_URL` si la prueba funciona:

   ```powershell
   python configure_local_db.py
   ```

   El `.env` debe apuntar a `127.0.0.1:5432/murcielago`. No publiques el `.env` ni compartas la contraseña.

5. Inicia la API con el loop compatible con Windows:

   ```powershell
   python run.py
   ```

   La API queda en `http://127.0.0.1:8000`; la documentación está en `http://127.0.0.1:8000/docs`. `/health` prueba la conexión con PostgreSQL.

---

## 📂 Estructura del repositorio
