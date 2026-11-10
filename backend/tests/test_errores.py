"""Un error sin manejar debe llegar al navegador como JSON y con cabeceras CORS."""

import asyncpg
import pytest
from fastapi import HTTPException

from app.core.errores import MENSAJE_500
from app.main import app

ORIGEN = "http://localhost:5173"


@pytest.fixture
def ruta_que_falla():
    """Agrega temporalmente una ruta que lanza la excepción indicada."""
    agregadas = []

    def agregar(excepcion: Exception) -> str:
        ruta = f"/_prueba/falla-{len(agregadas)}"

        async def falla():
            raise excepcion

        app.add_api_route(ruta, falla)
        agregadas.append(app.router.routes[-1])
        return ruta

    yield agregar
    for r in agregadas:
        app.router.routes.remove(r)


@pytest.mark.sin_bd
async def test_error_sin_manejar_responde_json_con_cors(cliente, ruta_que_falla):
    ruta = ruta_que_falla(RuntimeError("se rompió algo"))
    r = await cliente.get(ruta, headers={"Origin": ORIGEN})
    assert r.status_code == 500
    assert r.json() == {"detail": MENSAJE_500}
    assert r.headers["access-control-allow-origin"] == ORIGEN
    assert "se rompió algo" not in r.text  # el detalle interno no se le muestra al usuario


@pytest.mark.sin_bd
async def test_columna_inexistente_avisa_de_migracion_en_el_log(cliente, ruta_que_falla, caplog):
    ruta = ruta_que_falla(asyncpg.UndefinedColumnError('column "escuela" does not exist'))
    r = await cliente.get(ruta, headers={"Origin": ORIGEN})
    assert r.status_code == 500
    assert "falta una migración" in caplog.text


@pytest.mark.sin_bd
async def test_errores_http_normales_no_cambian(cliente, ruta_que_falla):
    ruta = ruta_que_falla(HTTPException(status_code=403, detail="No tienes permiso."))
    r = await cliente.get(ruta, headers={"Origin": ORIGEN})
    assert r.status_code == 403
    assert r.json() == {"detail": "No tienes permiso."}
    assert r.headers["access-control-allow-origin"] == ORIGEN
