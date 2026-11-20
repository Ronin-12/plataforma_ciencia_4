-- 008: lo necesario para publicar el piloto.
--   * Datos de la escuela del docente (publica/privada y CCT) y aceptacion de terminos.
--   * Plan de cada docente (lo asigna el administrador despues de un acuerdo).
--   * Recuperacion de contrasena con enlaces de un solo uso.
--   * Limite diario de IA y registro de tokens (para conocer el costo real).
--   * Solicitudes de contacto que llegan desde la pagina de planes.
-- Idempotente (se puede correr dos veces). Solo caracteres ASCII: el cliente psql de Windows
-- (codificacion WIN1252) falla con acentos en archivos UTF-8.
BEGIN;

-- ---------------------------------------------------------------- docentes
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS tipo_escuela VARCHAR(10);
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS cct VARCHAR(10);
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS acepto_terminos_en TIMESTAMPTZ;
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS version_terminos VARCHAR(20);
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'gratis';
-- Cuando cambia la contrasena, las sesiones abiertas antes de ese momento dejan de valer.
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS password_cambiada_en TIMESTAMPTZ;

ALTER TABLE docentes DROP CONSTRAINT IF EXISTS ck_docentes_tipo_escuela;
ALTER TABLE docentes ADD CONSTRAINT ck_docentes_tipo_escuela
    CHECK (tipo_escuela IS NULL OR tipo_escuela IN ('publica', 'privada'));

ALTER TABLE docentes DROP CONSTRAINT IF EXISTS ck_docentes_plan;
ALTER TABLE docentes ADD CONSTRAINT ck_docentes_plan
    CHECK (plan IN ('gratis', 'maestro', 'docente', 'escuela'));

-- ------------------------------------------------- recuperar contrasena
-- Solo se guarda la huella (sha256) del enlace, nunca el enlace: si alguien lee la base, no le sirve.
CREATE TABLE IF NOT EXISTS recuperaciones_password (
    id_recuperacion UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    id_docente      UUID        NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    token_hash      CHAR(64)    NOT NULL UNIQUE,
    expira_en       TIMESTAMPTZ NOT NULL,
    usado_en        TIMESTAMPTZ,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recuperaciones_docente ON recuperaciones_password (id_docente, fecha_creacion DESC);

-- --------------------------------------------------------- uso de la IA
-- Contador por dia (el mensual ya existe en ia_generaciones_mes).
CREATE TABLE IF NOT EXISTS ia_generaciones_dia (
    id_docente    UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
    dia           DATE NOT NULL,
    generaciones  INT  NOT NULL DEFAULT 0 CHECK (generaciones >= 0),
    PRIMARY KEY (id_docente, dia)
);

-- Tokens que reporta el proveedor en cada llamada (tambien las fallidas: Google las cobra igual).
CREATE TABLE IF NOT EXISTS ia_uso_tokens (
    id_uso          BIGSERIAL   PRIMARY KEY,
    id_docente      UUID        REFERENCES docentes (id_docente) ON DELETE SET NULL,
    fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
    tarea           VARCHAR(20) NOT NULL,
    modelo          VARCHAR(80) NOT NULL,
    tokens_entrada  INT         NOT NULL DEFAULT 0 CHECK (tokens_entrada >= 0),
    tokens_salida   INT         NOT NULL DEFAULT 0 CHECK (tokens_salida >= 0)
);
CREATE INDEX IF NOT EXISTS idx_ia_uso_tokens_fecha ON ia_uso_tokens (fecha);
CREATE INDEX IF NOT EXISTS idx_ia_uso_tokens_docente ON ia_uso_tokens (id_docente, fecha);

-- ------------------------------------------------- solicitudes de contacto
CREATE TABLE IF NOT EXISTS solicitudes_contacto (
    id_solicitud    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    telefono        VARCHAR(20),
    escuela         VARCHAR(120) NOT NULL,
    tipo_escuela    VARCHAR(10)  NOT NULL CHECK (tipo_escuela IN ('publica', 'privada')),
    cct             VARCHAR(10),
    num_docentes    INT          NOT NULL CHECK (num_docentes BETWEEN 1 AND 500),
    plan_interes    VARCHAR(20)  NOT NULL CHECK (plan_interes IN ('maestro', 'docente', 'escuela', 'licencia', 'otro')),
    mensaje         VARCHAR(1000),
    estado          VARCHAR(12)  NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'en_proceso', 'cerrada')),
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes_contacto (fecha_creacion DESC);

COMMIT;
