-- =====================================================================
-- Migracion 006 - Varios grupos por docente, materia/grado reales y actividades por grupo
-- Se puede ejecutar mas de una vez.
--
--   1. grupos.nombre: cada docente puede tener varios grupos (4.o A, 4.o B...).
--   2. juegos_generados.materia y .grado: antes solo vivian como texto dentro de prompt_original.
--   3. juegos_grupos: a QUE grupos se asigna cada actividad. Un alumno ve solo lo de su grupo.
--
-- Lo que ya existe sigue funcionando: cada actividad actual queda asignada a todos los grupos
-- que su docente ya tenia.
--
-- psql -U postgres -d murcielago -f db\migraciones\006_grupos_materias.sql
-- =====================================================================
BEGIN;

-- 1. Nombre del grupo ------------------------------------------------------------------------
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS nombre VARCHAR(40);

-- A los grupos que ya existen se les pone un nombre: "4.o A", "4.o B"... por docente y grado.
WITH numerados AS (
    SELECT id_grupo, grado,
           ROW_NUMBER() OVER (PARTITION BY id_docente, grado ORDER BY fecha_creacion, id_grupo) AS n
      FROM grupos
     WHERE nombre IS NULL
)
UPDATE grupos g
   SET nombre = n.grado || '.' || CHR(186) || ' ' || CHR(64 + LEAST(n.n, 26)::int)  -- "4.o A" (CHR(186) = o)
  FROM numerados n
 WHERE g.id_grupo = n.id_grupo;

ALTER TABLE grupos ALTER COLUMN nombre SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_docente_nombre ON grupos (id_docente, LOWER(nombre));

-- 2. Materia y grado de cada actividad ---------------------------------------------------------
ALTER TABLE juegos_generados ADD COLUMN IF NOT EXISTS materia VARCHAR(20);
ALTER TABLE juegos_generados ADD COLUMN IF NOT EXISTS grado   SMALLINT;

-- Las actividades creadas con el generador nuevo traian "Materia: X. Grado: Y." al inicio del
-- pedido. Se pasa a las columnas lo que se pueda reconocer; el resto queda en NULL.
UPDATE juegos_generados
   SET materia = CASE
        WHEN t ~ '^ciencias'   THEN 'ciencias'
        WHEN t ~ '^matem'      THEN 'matematicas'
        WHEN t ~ '^espa'       THEN 'espanol'
        WHEN t ~ '^historia'   THEN 'historia'
        WHEN t ~ '^geograf'    THEN 'geografia'
        WHEN t ~ '^formaci'    THEN 'civica'
        WHEN t ~ '^ingl'       THEN 'ingles'
        WHEN t ~ '^artes'      THEN 'artes'
        ELSE NULL END
  FROM (SELECT id_juego, LOWER(SUBSTRING(prompt_original FROM 'Materia:\s*([^.\n]+)\.')) AS t
          FROM juegos_generados) x
 WHERE juegos_generados.id_juego = x.id_juego AND juegos_generados.materia IS NULL;

-- ".{2}" es el ".o" (el signo o puede ocupar uno o dos caracteres segun la codificacion).
UPDATE juegos_generados
   SET grado = (SUBSTRING(prompt_original FROM 'Grado:\s*([1-6])\..{1,2} de primaria'))::smallint
 WHERE grado IS NULL AND prompt_original ~ 'Grado:\s*[1-6]\..{1,2} de primaria';

ALTER TABLE juegos_generados DROP CONSTRAINT IF EXISTS ck_juegos_grado;
ALTER TABLE juegos_generados ADD CONSTRAINT ck_juegos_grado CHECK (grado IS NULL OR grado BETWEEN 1 AND 6);

-- 3. Que actividad ve cada grupo ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS juegos_grupos (
    id_juego         UUID        NOT NULL REFERENCES juegos_generados (id_juego) ON DELETE CASCADE,
    id_grupo         UUID        NOT NULL REFERENCES grupos (id_grupo) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_juego, id_grupo)
);
CREATE INDEX IF NOT EXISTS idx_juegos_grupos_grupo ON juegos_grupos (id_grupo);

-- Para no cambiarle nada a nadie: cada actividad existente se asigna a todos los grupos de su docente.
INSERT INTO juegos_grupos (id_juego, id_grupo)
SELECT j.id_juego, g.id_grupo
  FROM juegos_generados j JOIN grupos g ON g.id_docente = j.id_docente
ON CONFLICT DO NOTHING;

COMMIT;
