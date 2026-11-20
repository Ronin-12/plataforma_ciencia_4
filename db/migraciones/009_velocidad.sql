-- 009: velocidad de la IA.
--   * ia_tareas: las generaciones corren en segundo plano y la pantalla consulta su avance.
--   * ia_cache_material: si el docente sube el mismo material otra vez, se reutiliza el analisis.
--   * ia_uso_tokens.duracion_ms: cuanto tardo cada llamada (para ver la velocidad real en Administracion).
-- Idempotente (se puede correr dos veces). Solo caracteres ASCII: el cliente psql de Windows
-- (codificacion WIN1252) falla con acentos en archivos UTF-8.
BEGIN;

ALTER TABLE ia_uso_tokens ADD COLUMN IF NOT EXISTS duracion_ms INT CHECK (duracion_ms IS NULL OR duracion_ms >= 0);

CREATE TABLE IF NOT EXISTS ia_tareas (
    id_tarea        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    id_docente      UUID         NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    tipo            VARCHAR(12)  NOT NULL CHECK (tipo IN ('juego', 'clase', 'temas')),
    estado          VARCHAR(12)  NOT NULL DEFAULT 'en_proceso' CHECK (estado IN ('en_proceso', 'lista', 'error')),
    etapa           VARCHAR(120) NOT NULL DEFAULT 'Preparando...',
    resultado       JSONB,
    error_estado    INT,
    error_detalle   TEXT,
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fecha_fin       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ia_tareas_docente ON ia_tareas (id_docente, fecha_creacion DESC);

-- Solo se guarda lo que respondio la IA (nunca los archivos). Se borra con la cuenta del docente.
CREATE TABLE IF NOT EXISTS ia_cache_material (
    id_docente      UUID        NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    huella          CHAR(64)    NOT NULL,
    temas           JSONB       NOT NULL,
    contexto        TEXT        NOT NULL DEFAULT '',
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id_docente, huella)
);

COMMIT;
