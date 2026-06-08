from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DimType(Base):
    __tablename__ = "dim_type"

    type_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    input_type: Mapped[str] = mapped_column(String(80), nullable=False)   # what goes in: webinar, podcast, interview, etc.
    output_type: Mapped[str] = mapped_column(String(80), nullable=False)  # what comes out: shorts, reels, clips, etc.

    def __repr__(self):
        return f"<DimType {self.input_type} → {self.output_type}>"
