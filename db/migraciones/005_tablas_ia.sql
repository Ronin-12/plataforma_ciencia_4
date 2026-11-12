-- =====================================================================
-- Migración 005 - Tablas de IA (sesiones, créditos y juegos)
-- Se puede ejecutar más de una vez.
--
-- Estas tres tablas se creaban cada vez que arrancaba la API (db/session.py). Ahora viven
-- aquí, como el resto de cambios de esquema, y el arranque solo comprueba que existan.
-- Si ya las tenías (porque la API las creó), esta migración no cambia nada.
--
-- psql -U postgres -d murcielago -f db\migraciones\005_tablas_ia.sql
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sesiones_docente (
    id_sesion       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_docente      UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    titulo          VARCHAR(160) NOT NULL,
    tema            VARCHAR(240) NOT NULL,
    material_nombre VARCHAR(255),
    contexto        TEXT NOT NULL DEFAULT '',
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sesiones_docente_fecha ON sesiones_docente (id_docente, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS ia_generaciones_mes (
    id_docente   UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    periodo      DATE NOT NULL,
    generaciones INTEGER NOT NULL DEFAULT 0 CHECK (generaciones >= 0),
    PRIMARY KEY (id_docente, periodo)
);

CREATE TABLE IF NOT EXISTS juegos_generados (
    id_juego        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_docente      UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    prompt_original TEXT NOT NULL,
    contenido_juego JSONB NOT NULL,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_juegos_generados_id_docente ON juegos_generados (id_docente);
ALTER TABLE juegos_generados
    ADD COLUMN IF NOT EXISTS id_sesion UUID REFERENCES sesiones_docente (id_sesion) ON DELETE SET NULL;

COMMIT;
