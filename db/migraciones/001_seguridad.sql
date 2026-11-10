-- =====================================================================
-- Migración 001 - Seguridad (Sprint 2)
-- Se aplica DESPUÉS de db/schema_v2.sql. Se puede ejecutar más de una vez.
--
--   1. PIN de alumno guardado como hash (bcrypt), nunca en claro (RNF-02).
--   2. Correos de docente únicos sin distinguir mayúsculas.
--   3. Rol de docente limitado a valores válidos.
--   4. Contadores para bloquear temporalmente tras intentos fallidos.
--
-- psql -U postgres -d murcielago -f db\migraciones\001_seguridad.sql
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- DOCENTES
UPDATE docentes SET email = lower(email) WHERE email <> lower(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_email_lower ON docentes (lower(email));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_docentes_rol') THEN
        ALTER TABLE docentes
            ADD CONSTRAINT ck_docentes_rol CHECK (rol IN ('docente', 'administrador'));
    END IF;
END $$;

ALTER TABLE docentes ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

-- ----------------------------------------------------------------- ALUMNOS
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(100);
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'alumnos' AND column_name = 'pin_seguridad'
    ) THEN
        -- Los PIN que ya existían se convierten a bcrypt y se elimina el texto.
        UPDATE alumnos
           SET pin_hash = crypt(lpad(pin_seguridad::text, 4, '0'), gen_salt('bf', 12))
         WHERE pin_hash IS NULL;
        ALTER TABLE alumnos DROP CONSTRAINT IF EXISTS uq_alumnos_grupo_pin;
        ALTER TABLE alumnos DROP COLUMN pin_seguridad;
    END IF;
END $$;

ALTER TABLE alumnos ALTER COLUMN pin_hash SET NOT NULL;

COMMIT;
