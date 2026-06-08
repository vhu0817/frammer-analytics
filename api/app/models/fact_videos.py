from sqlalchemy import Integer, Float, Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FactVideos(Base):
    __tablename__ = "fact_videos"

    video_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # foreign keys to all 5 dimensions
    client_id: Mapped[int] = mapped_column(ForeignKey("dim_client.client_id"), nullable=False)
    channel_id: Mapped[int] = mapped_column(ForeignKey("dim_channel.channel_id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("dim_user.user_id"), nullable=False)
    type_id: Mapped[int] = mapped_column(ForeignKey("dim_type.type_id"), nullable=False)
    platform_id: Mapped[int] = mapped_column(ForeignKey("dim_platform.platform_id"), nullable=True)  # null if not yet published

    # the video's journey: uploaded → processed → published
    # processed_at and published_at are null until that step happens
    uploaded_at: Mapped[str] = mapped_column(DateTime, nullable=False)
    processed_at: Mapped[str | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[str | None] = mapped_column(DateTime, nullable=True)

    # how long the source video is, in seconds
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)

    # status flags — redundant with the timestamps but way faster to filter on
    # than checking "WHERE processed_at IS NOT NULL" across 15k rows
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # optional title for the explorer table — can be null for the 5% "bad data" rows
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # relationships (for ORM-style joins when we need them)
    client = relationship("DimClient")
    channel = relationship("DimChannel")
    user = relationship("DimUser")
    video_type = relationship("DimType")
    platform = relationship("DimPlatform")

    # composite indexes for the queries we know we'll run a lot.
    # without these, postgres does sequential scans on 15k+ rows every time
    __table_args__ = (
        # dashboard queries almost always filter by client + date range
        Index("ix_fact_client_uploaded", "client_id", "uploaded_at"),

        # trends page groups by channel over time
        Index("ix_fact_channel_uploaded", "channel_id", "uploaded_at"),

        # funnel queries filter on status flags
        Index("ix_fact_status", "is_processed", "is_published"),

        # explorer page sorts/filters by upload date
        Index("ix_fact_uploaded", "uploaded_at"),
    )

    def __repr__(self):
        return f"<FactVideos {self.video_id} uploaded={self.uploaded_at}>"
