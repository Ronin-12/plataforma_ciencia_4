"""Capa de IA intercambiable: `obtener_proveedor()` devuelve el proveedor elegido en `.env`."""

from app.core.config import settings
from app.ia.base import ErrorProveedor, ProveedorIA, Solicitud
from app.ia.demo import ProveedorDemo
from app.ia.gemini import ProveedorGemini

# Para añadir un proveedor: crea su clase y regístrala aquí; se elige con IA_PROVEEDOR en .env.
PROVEEDORES: dict[str, type[ProveedorIA]] = {
    "gemini": ProveedorGemini,
    "demo": ProveedorDemo,
}


def obtener_proveedor() -> ProveedorIA:
    clase = PROVEEDORES.get(settings.IA_PROVEEDOR.strip().lower())
    if clase is None:
        raise RuntimeError(
            f"IA_PROVEEDOR='{settings.IA_PROVEEDOR}' no existe. Opciones: {', '.join(PROVEEDORES)}."
        )
    return clase()


__all__ = ["ErrorProveedor", "ProveedorIA", "Solicitud", "obtener_proveedor"]
