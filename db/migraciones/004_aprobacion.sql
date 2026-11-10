-- =====================================================================
-- Migración 004 - Aprobación del docente (Sprint B)
-- Se aplica DESPUÉS de 001, 002 y 003. Se puede ejecutar más de una vez.
--
--   Un juego creado por la IA nace como BORRADOR: los alumnos solo ven los juegos
--   APROBADOS por su docente (revisión humana del contenido de la IA).
--
--   Estados: borrador -> aprobado -> (retirado: vuelve a borrador) / descartado.
--   Los juegos que ya existían se marcan como aprobados para que no desaparezcan
--   de la pantalla de los alumnos al aplicar esta migración.
--
-- psql -U postgres -d murcielago -f db\migraciones\004_aprobacion.sql
-- =====================================================================
BEGIN;

-- Las filas que ya existen reciben 'aprobado'; después el valor por omisión pasa a 'borrador'.
-- (Al repetir la migración, la columna ya existe y no se vuelve a tocar ningún juego.)
ALTER TABLE juegos_generados ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'aprobado';
ALTER TABLE juegos_generados ALTER COLUMN estado SET DEFAULT 'borrador';
ALTER TABLE juegos_generados ADD COLUMN IF NOT EXISTS fecha_aprobacion TIMESTAMPTZ;

UPDATE juegos_generados SET fecha_aprobacion = fecha_creacion
 WHERE estado = 'aprobado' AND fecha_aprobacion IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_juegos_estado') THEN
        ALTER TABLE juegos_generados
            ADD CONSTRAINT ck_juegos_estado CHECK (estado IN ('borrador', 'aprobado', 'descartado'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_juegos_docente_estado ON juegos_generados (id_docente, estado);

COMMIT;
