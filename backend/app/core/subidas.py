"""Tope de tamaño para las subidas de archivos.

FastAPI recibe el cuerpo completo de una subida antes de ejecutar la ruta, así que un
archivo enorme se acepta, se guarda en disco temporal y solo después se rechaza. Este
middleware corta antes, mirando la cabecera Content-Length. No cubre las subidas sin esa
cabecera (envío por fragmentos); para eso, en producción, el servidor web (nginx, Azure)
también debe limitar el tamaño del cuerpo.
"""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# Los archivos suman 20 MB como máximo; el resto es margen del formato multipart.
MARGEN_MULTIPART = 2 * 1024 * 1024


class LimiteSubidas:
    def __init__(self, app: ASGIApp, ruta: str, max_bytes: int) -> None:
        self.app = app
        self.ruta = ruta
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] == "POST" and scope["path"] == self.ruta:
            largo = dict(scope["headers"]).get(b"content-length", b"")
            if largo.isdigit() and int(largo) > self.max_bytes:
                respuesta = JSONResponse(
                    {"detail": "El conjunto de archivos supera 20 MB."}, status_code=413
                )
                await respuesta(scope, receive, send)
                return
        await self.app(scope, receive, send)
