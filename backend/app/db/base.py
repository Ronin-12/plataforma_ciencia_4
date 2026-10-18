"""Base declarativa de SQLAlchemy para los modelos del proyecto."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Clase base que deben heredar los modelos ORM."""

    pass
