"""La API no debe arrancar con claves débiles o ya publicadas."""

import pytest
from pydantic import ValidationError

from app.core.config import CLAVES_PUBLICAS, Settings


def _crear(**extra):
    return Settings(_env_file=None, DATABASE_URL="postgresql://x/y", **extra)


def test_rechaza_clave_corta():
    with pytest.raises(ValidationError):
        _crear(SECRET_KEY="corta")


def test_rechaza_clave_que_estuvo_publicada():
    with pytest.raises(ValidationError):
        _crear(SECRET_KEY=next(iter(CLAVES_PUBLICAS)))


def test_rechaza_marcador_del_ejemplo():
    with pytest.raises(ValidationError):
        _crear(SECRET_KEY="CAMBIA_ESTA_CLAVE_" + "x" * 40)


def test_acepta_clave_larga_y_propia():
    assert _crear(SECRET_KEY="k" * 64).SECRET_KEY == "k" * 64


def test_invitacion_corta_se_rechaza_pero_vacia_se_permite():
    with pytest.raises(ValidationError):
        _crear(SECRET_KEY="k" * 64, CODIGO_INVITACION_DOCENTES="abc")
    assert _crear(SECRET_KEY="k" * 64, CODIGO_INVITACION_DOCENTES="").CODIGO_INVITACION_DOCENTES == ""
