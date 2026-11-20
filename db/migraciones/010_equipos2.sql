-- 010: equipos 2.0.
--   * Una mision puede tener de 1 a 5 juegos (retos_equipo_juegos) y un modo:
--       'todos' = cada integrante juega todos los juegos; 'roles' = a cada integrante le toca uno.
--   * misiones_logradas: quien aporto a un equipo que llego a la meta (base de la insignia "Equipo estrella").
--     El avance de la mision sigue sin guardarse, pero los equipos cambian y las misiones se cierran,
--     asi que el logro SI se guarda para no perderlo.
-- Idempotente (se puede correr dos veces). Solo caracteres ASCII: el cliente psql de Windows
-- (codificacion WIN1252) falla con acentos en archivos UTF-8.
BEGIN;

ALTER TABLE retos_equipo ADD COLUMN IF NOT EXISTS modo VARCHAR(8) NOT NULL DEFAULT 'todos';
ALTER TABLE retos_equipo DROP CONSTRAINT IF EXISTS ck_retos_equipo_modo;
ALTER TABLE retos_equipo ADD CONSTRAINT ck_retos_equipo_modo CHECK (modo IN ('todos', 'roles'));

-- Los juegos de cada mision, en orden. retos_equipo.id_juego se conserva como el primero.
CREATE TABLE IF NOT EXISTS retos_equipo_juegos (
    id_reto   UUID     NOT NULL REFERENCES retos_equipo (id_reto) ON DELETE CASCADE,
    id_juego  UUID     NOT NULL REFERENCES juegos_generados (id_juego) ON DELETE CASCADE,
    posicion  SMALLINT NOT NULL CHECK (posicion BETWEEN 1 AND 5),
    PRIMARY KEY (id_reto, id_juego)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_retos_equipo_juegos_posicion ON retos_equipo_juegos (id_reto, posicion);

-- Las misiones que ya existian tenian un solo juego: pasan a la tabla nueva.
INSERT INTO retos_equipo_juegos (id_reto, id_juego, posicion)
SELECT id_reto, id_juego, 1 FROM retos_equipo
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS misiones_logradas (
    id_reto    UUID      NOT NULL REFERENCES retos_equipo (id_reto) ON DELETE CASCADE,
    id_alumno  UUID      NOT NULL REFERENCES alumnos (id_alumno) ON DELETE CASCADE,
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_reto, id_alumno)
);
CREATE INDEX IF NOT EXISTS idx_misiones_logradas_alumno ON misiones_logradas (id_alumno);

COMMIT;
