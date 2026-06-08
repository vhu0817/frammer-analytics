from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DimUser(Base):
    __tablename__ = "dim_user"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("dim_client.client_id"), nullable=False)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    team_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)  # website_admin, client_admin, user
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # relationships
    client = relationship("DimClient", back_populates="users")

    def __repr__(self):
        return f"<DimUser {self.email} ({self.role})>"
