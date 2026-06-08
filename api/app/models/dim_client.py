from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DimClient(Base):
    __tablename__ = "dim_client"

    client_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    client_segment: Mapped[str] = mapped_column(String(50), nullable=False)  # enterprise, mid-market, startup
    region: Mapped[str] = mapped_column(String(50), nullable=False)

    # one client has many channels and many users
    channels = relationship("DimChannel", back_populates="client")
    users = relationship("DimUser", back_populates="client")

    def __repr__(self):
        return f"<DimClient {self.client_name} ({self.client_segment})>"
