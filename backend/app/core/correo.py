"""Envío de correos (por ahora solo el de recuperar contraseña).

Se usa SMTP, que ofrece cualquier proveedor de correo (el de IONOS, Gmail con contraseña de
aplicación, Brevo, etc.). Si SMTP_HOST está vacío, el correo NO se envía: se escribe en la
terminal del backend para poder probar en local. En producción SMTP_HOST es obligatorio.
"""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("murcielago")


def correo_configurado() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_REMITENTE)


def _es_local() -> bool:
    return any(h in settings.URL_FRONTEND for h in ("localhost", "127.0.0.1"))


def _enviar_smtp(mensaje: EmailMessage) -> None:
    contexto = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=contexto, timeout=15) as smtp:
            if settings.SMTP_USUARIO:
                smtp.login(settings.SMTP_USUARIO, settings.SMTP_PASSWORD)
            smtp.send_message(mensaje)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls(context=contexto)
            if settings.SMTP_USUARIO:
                smtp.login(settings.SMTP_USUARIO, settings.SMTP_PASSWORD)
            smtp.send_message(mensaje)


async def enviar_correo(destino: str, asunto: str, texto: str) -> None:
    """Envía un correo de texto. Nunca lanza: si falla, lo deja anotado en el log."""
    if not correo_configurado():
        if _es_local():
            logger.warning(
                "CORREO SIN ENVIAR (falta SMTP_HOST en .env). Para %s | %s\n%s", destino, asunto, texto
            )
        else:
            # Fuera de local no se escribe el contenido: el enlace quedaría guardado en los logs.
            logger.error("CORREO SIN ENVIAR: configura SMTP_HOST y SMTP_REMITENTE en .env. Asunto: %s", asunto)
        return
    mensaje = EmailMessage()
    mensaje["From"] = settings.SMTP_REMITENTE
    mensaje["To"] = destino
    mensaje["Subject"] = asunto
    mensaje.set_content(texto)
    try:
        # smtplib es bloqueante: se manda en otro hilo para no frenar a los demás usuarios.
        await asyncio.to_thread(_enviar_smtp, mensaje)
    except Exception:  # noqa: BLE001 - un fallo de correo no debe tumbar la petición
        logger.exception("No se pudo enviar el correo a %s", destino)
