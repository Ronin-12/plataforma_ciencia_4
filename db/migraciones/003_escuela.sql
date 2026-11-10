-- =====================================================================
-- Migración 003 - Escuela del docente (Sprint A)
-- Se aplica DESPUÉS de 001 y 002. Se puede ejecutar más de una vez.
--
--   El formulario de registro pedía la escuela pero no se guardaba.
--
-- psql -U postgres -d murcielago -f db\migraciones\003_escuela.sql
-- =====================================================================
BEGIN;

ALTER TABLE docentes ADD COLUMN IF NOT EXISTS escuela VARCHAR(120);

COMMIT;
