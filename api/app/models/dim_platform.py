from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DimPlatform(Base):
    __tablename__ = "dim_platform"

    platform_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    platform_name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)

    def __repr__(self):
        return f"<DimPlatform {self.platform_name}>"
