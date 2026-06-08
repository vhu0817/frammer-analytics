from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DimChannel(Base):
    __tablename__ = "dim_channel"

    channel_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("dim_client.client_id"), nullable=False)
    channel_name: Mapped[str] = mapped_column(String(150), nullable=False)
    workspace: Mapped[str] = mapped_column(String(100), nullable=False)  # team/department that owns this channel
    language: Mapped[str] = mapped_column(String(50), nullable=False)

    # relationships
    client = relationship("DimClient", back_populates="channels")

    def __repr__(self):
        return f"<DimChannel {self.channel_name} ({self.language})>"
