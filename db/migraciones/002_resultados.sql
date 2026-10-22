-- =====================================================================
-- Migración 002 - Resultados de juegos generados por IA (RF-05 / RF-06)
-- Se aplica DESPUÉS de db/schema_v2.sql y de 001_seguridad.sql. Se puede ejecutar más de una vez.
--
-- Hasta ahora registro_avances solo podía apuntar al catálogo de 3 actividades fijas.
-- Ahora cada fila apunta a UNA de dos cosas: una actividad del catálogo (id_actividad)
-- o un juego generado por IA (id_juego). Cuando el Product Owner defina las actividades
-- oficiales se seguirán usando con id_actividad, sin tocar lo ya guardado.
--
-- psql -U postgres -d murcielago -f db\migraciones\002_resultados.sql
-- =====================================================================
BEGIN;

ALTER TABLE registro_avances
    ADD COLUMN IF NOT EXISTS id_juego UUID
    REFERENCES juegos_generados (id_juego) ON DELETE CASCADE;

ALTER TABLE registro_avances ALTER COLUMN id_actividad DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_registro_origen') THEN
        -- Exactamente uno de los dos: o actividad del catálogo, o juego generado.
        ALTER TABLE registro_avances
            ADD CONSTRAINT ck_registro_origen
            CHECK ((id_actividad IS NOT NULL) <> (id_juego IS NOT NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_registro_puntuacion_pct') THEN
        -- Para juegos generados la puntuación es un porcentaje (0 a 100).
        ALTER TABLE registro_avances
            ADD CONSTRAINT ck_registro_puntuacion_pct
            CHECK (id_juego IS NULL OR puntuacion_final <= 100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registro_id_juego ON registro_avances (id_juego);

-- Un alumno no puede tener dos veces el mismo número de intento en el mismo juego,
-- ni siquiera si dos envíos llegan al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_registro_intento_juego
    ON registro_avances (id_alumno, id_juego, numero_intento)
    WHERE id_juego IS NOT NULL;

COMMIT;
