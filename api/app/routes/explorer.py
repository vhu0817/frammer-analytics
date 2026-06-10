import csv
import io
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.fact_videos import FactVideos
from app.models.dim_client import DimClient
from app.models.dim_channel import DimChannel
from app.models.dim_user import DimUser
from app.models.dim_type import DimType
from app.models.dim_platform import DimPlatform
from app.services.query_builder import scoped_query, apply_filters

router = APIRouter()

# these are the columns the frontend can sort by
SORTABLE_COLUMNS = {
    "uploaded_at": FactVideos.uploaded_at,
    "duration": FactVideos.duration_seconds,
    "processed_at": FactVideos.processed_at,
    "published_at": FactVideos.published_at,
}


def _base_explorer_query(db, user, start_date, end_date, client_id, channel_id, user_id, type_id, platform_id, search):
    """shared query logic for both the paginated list and CSV export."""
    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date,
                       client_id=client_id, channel_id=channel_id,
                       user_id=user_id, type_id=type_id, platform_id=platform_id)

    # join all dimensions so we can show names instead of just IDs
    q = (
        q.join(DimClient, FactVideos.client_id == DimClient.client_id)
        .join(DimChannel, FactVideos.channel_id == DimChannel.channel_id)
        .join(DimUser, FactVideos.user_id == DimUser.user_id)
        .join(DimType, FactVideos.type_id == DimType.type_id)
        .join(DimPlatform, FactVideos.platform_id == DimPlatform.platform_id)
    )

    # simple text search across client name, channel name, and username
    if search:
        like_pattern = f"%{search}%"
        q = q.filter(
            DimClient.client_name.ilike(like_pattern)
            | DimChannel.channel_name.ilike(like_pattern)
            | DimUser.username.ilike(like_pattern)
        )

    return q


def _select_columns():
    """the columns we want in both list and export."""
    return [
        FactVideos.video_id,
        DimClient.client_name.label("client"),
        DimChannel.channel_name.label("channel"),
        DimUser.username.label("user"),
        DimType.input_type,
        DimType.output_type,
        DimPlatform.platform_name.label("platform"),
        FactVideos.uploaded_at,
        FactVideos.processed_at,
        FactVideos.published_at,
        FactVideos.duration_seconds,
        FactVideos.is_processed,
        FactVideos.is_published,
    ]


@router.get("/videos")
def get_videos(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=100),
    sort_by: str = Query(default="uploaded_at"),
    sort_dir: str = Query(default="desc", regex="^(asc|desc)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    user_id: Optional[int] = None,
    type_id: Optional[int] = None,
    platform_id: Optional[int] = None,
    search: Optional[str] = None,
):
    q = _base_explorer_query(db, user, start_date, end_date,
                              client_id, channel_id, user_id, type_id, platform_id, search)

    # get total count before pagination
    total = q.with_entities(func.count(FactVideos.video_id)).scalar()

    # sorting
    sort_col = SORTABLE_COLUMNS.get(sort_by, FactVideos.uploaded_at)
    order_fn = desc if sort_dir == "desc" else asc
    q = q.order_by(order_fn(sort_col))

    # pagination
    offset = (page - 1) * page_size
    rows = q.with_entities(*_select_columns()).offset(offset).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "videos": [
            {
                "video_id": r.video_id,
                "client": r.client,
                "channel": r.channel,
                "user": r.user,
                "input_type": r.input_type,
                "output_type": r.output_type,
                "platform": r.platform,
                "uploaded_at": str(r.uploaded_at) if r.uploaded_at else None,
                "processed_at": str(r.processed_at) if r.processed_at else None,
                "published_at": str(r.published_at) if r.published_at else None,
                "duration_seconds": r.duration_seconds,
                "is_processed": r.is_processed,
                "is_published": r.is_published,
            }
            for r in rows
        ],
    }


@router.get("/export")
def export_csv(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    user_id: Optional[int] = None,
    type_id: Optional[int] = None,
    platform_id: Optional[int] = None,
    search: Optional[str] = None,
):
    q = _base_explorer_query(db, user, start_date, end_date,
                              client_id, channel_id, user_id, type_id, platform_id, search)
    q = q.order_by(desc(FactVideos.uploaded_at))

    rows = q.with_entities(*_select_columns()).all()

    # write to an in-memory buffer
    output = io.StringIO()
    writer = csv.writer(output)

    # header row
    writer.writerow([
        "video_id", "client", "channel", "user", "input_type", "output_type",
        "platform", "uploaded_at", "processed_at", "published_at",
        "duration_seconds", "is_processed", "is_published",
    ])

    for r in rows:
        writer.writerow([
            r.video_id, r.client, r.channel, r.user,
            r.input_type, r.output_type, r.platform,
            r.uploaded_at, r.processed_at, r.published_at,
            r.duration_seconds, r.is_processed, r.is_published,
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=frammer_videos_export.csv"},
    )
