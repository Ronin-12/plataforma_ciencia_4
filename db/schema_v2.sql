-- =====================================================================
-- Plataforma educativa Ciencias Naturales 4.º grado - Equipo Murciélago
-- Esquema v2 (PostgreSQL / Azure) - 5 tablas
-- =====================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- DOCENTES: cuentas de docentes. Autenticación con email + password
-- (hash bcrypt generado en la aplicación; nunca se guarda texto plano).
-- ---------------------------------------------------------------------
CREATE TABLE docentes (
    id_docente      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(120) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,   -- bcrypt ($2b$..., 60 chars)
    rol             VARCHAR(30)  NOT NULL DEFAULT 'docente',
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- GRUPOS: aulas de un docente. El codigo_acceso es el "código de aula"
-- que los alumnos usan, junto con su PIN, para entrar.
-- ---------------------------------------------------------------------
CREATE TABLE grupos (
    id_grupo        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_acceso   VARCHAR(20) NOT NULL UNIQUE,
    grado           INT         NOT NULL CHECK (grado BETWEEN 1 AND 6),
    id_docente      UUID        NOT NULL
                    REFERENCES docentes (id_docente) ON DELETE CASCADE,
    fecha_creacion  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_grupos_id_docente ON grupos (id_docente);

-- ---------------------------------------------------------------------
-- ALUMNOS: perfil mínimo del menor (solo nombre de pila, PIN y avatar).
-- Sin correo ni datos personales adicionales.
-- ---------------------------------------------------------------------
CREATE TABLE alumnos (
    id_alumno       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_pila     VARCHAR(60)  NOT NULL,
    pin_seguridad   INT          NOT NULL CHECK (pin_seguridad BETWEEN 0 AND 9999),
    avatar_url      VARCHAR(500),
    id_grupo        UUID         NOT NULL
                    REFERENCES grupos (id_grupo) ON DELETE CASCADE,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    -- El login (código de aula + PIN) debe identificar a un solo alumno.
    -- NOTA: el backend debe generar PINs únicos por grupo automáticamente
    -- al crear alumnos (el docente no los elige a mano).
    CONSTRAINT uq_alumnos_grupo_pin UNIQUE (id_grupo, pin_seguridad)
);
CREATE INDEX idx_alumnos_id_grupo ON alumnos (id_grupo);

-- ---------------------------------------------------------------------
-- ACTIVIDADES_JUEGOS: catálogo de juegos del piloto (3 actividades)
-- y los puntos que otorga cada uno.
-- ---------------------------------------------------------------------
CREATE TABLE actividades_juegos (
    id_actividad    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_juego    VARCHAR(120) NOT NULL,
    campo_formativo VARCHAR(80)  NOT NULL,
    recompensa_pts  INT          NOT NULL DEFAULT 0 CHECK (recompensa_pts >= 0),
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descripcion     TEXT
);

-- ---------------------------------------------------------------------
-- REGISTRO_AVANCES: historial de cada ejecución de una actividad por un
-- alumno (puntaje, tiempo en segundos, intento y fecha). Base de los reportes.
-- ---------------------------------------------------------------------
CREATE TABLE registro_avances (
    id_registro       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    id_alumno         UUID      NOT NULL
                      REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
    id_actividad      UUID      NOT NULL
                      REFERENCES actividades_juegos (id_actividad) ON DELETE RESTRICT,
    puntuacion_final  INT       NOT NULL CHECK (puntuacion_final >= 0),
    tiempo_resolucion INT       NOT NULL CHECK (tiempo_resolucion >= 0),
    fecha_ejecucion   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    numero_intento    INT       NOT NULL DEFAULT 1 CHECK (numero_intento >= 1)
);
CREATE INDEX idx_registro_id_alumno    ON registro_avances (id_alumno);
CREATE INDEX idx_registro_id_actividad ON registro_avances (id_actividad);

COMMIT;