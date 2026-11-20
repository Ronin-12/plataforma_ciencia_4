-- 007: equipos cooperativos dentro de un grupo y misiones en equipo.
-- Idempotente (se puede correr dos veces). Solo caracteres ASCII: el cliente psql de Windows
-- (codificacion WIN1252) falla con acentos en archivos UTF-8.
BEGIN;

-- Un equipo pertenece a un grupo (por ejemplo "Aguilas" dentro de 4.A).
-- "icono" es un identificador (estrella, cohete...): el dibujo lo pone la interfaz.
CREATE TABLE IF NOT EXISTS equipos (
    id_equipo       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    id_grupo        UUID        NOT NULL REFERENCES grupos (id_grupo) ON DELETE CASCADE,
    nombre          VARCHAR(40) NOT NULL,
    icono           VARCHAR(20) NOT NULL DEFAULT 'estrella',
    fecha_creacion  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_equipos_grupo_nombre ON equipos (id_grupo, LOWER(nombre));

-- Un alumno esta en un solo equipo (la llave primaria es el alumno).
CREATE TABLE IF NOT EXISTS equipos_alumnos (
    id_alumno  UUID PRIMARY KEY REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
    id_equipo  UUID NOT NULL    REFERENCES equipos (id_equipo) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_equipos_alumnos_equipo ON equipos_alumnos (id_equipo);

-- Mision en equipo: una actividad del grupo y la meta (% promedio) que cada equipo debe alcanzar.
-- El avance no se guarda: se calcula con los mejores resultados de cada integrante desde fecha_inicio.
CREATE TABLE IF NOT EXISTS retos_equipo (
    id_reto       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    id_grupo      UUID        NOT NULL REFERENCES grupos (id_grupo) ON DELETE CASCADE,
    id_juego      UUID        NOT NULL REFERENCES juegos_generados (id_juego) ON DELETE CASCADE,
    meta          INT         NOT NULL CHECK (meta BETWEEN 10 AND 100),
    estado        VARCHAR(10) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
    fecha_inicio  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre  TIMESTAMP
);
-- Solo una mision abierta por grupo a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_retos_equipo_abierto ON retos_equipo (id_grupo) WHERE estado = 'abierto';
CREATE INDEX IF NOT EXISTS idx_retos_equipo_grupo ON retos_equipo (id_grupo, fecha_inicio DESC);

COMMIT;
