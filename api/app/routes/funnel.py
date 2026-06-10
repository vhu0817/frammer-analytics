from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.fact_videos import FactVideos
from app.models.dim_type import DimType
from app.models.dim_client import DimClient
from app.services.query_builder import scoped_query, apply_filters

router = APIRouter()


@router.get("/stages")
def get_stages(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
):
    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date,
                       client_id=client_id, channel_id=channel_id)

    row = q.with_entities(
        func.count(FactVideos.video_id).label("uploaded"),
        func.count().filter(FactVideos.is_processed == True).label("processed"),
        func.count().filter(FactVideos.is_published == True).label("published"),
    ).one()

    uploaded = row.uploaded
    processed = row.processed
    published = row.published

    return {
        "stages": [
            {
                "name": "Uploaded",
                "count": uploaded,
                "rate": 100.0,
            },
            {
                "name": "Processed",
                "count": processed,
                "rate": round(processed / uploaded * 100, 1) if uploaded else 0,
                "drop_off": uploaded - processed,
                "drop_off_pct": round((uploaded - processed) / uploaded * 100, 1) if uploaded else 0,
            },
            {
                "name": "Published",
                "count": published,
                "rate": round(published / uploaded * 100, 1) if uploaded else 0,
                "drop_off": processed - published,
                "drop_off_pct": round((processed - published) / processed * 100, 1) if processed else 0,
            },
        ],
    }


@router.get("/conversion")
def get_conversion(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    breakdown: str = Query(default="client", regex="^(client|channel|user)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    # conversion rates broken down by a dimension
    if breakdown == "client":
        model, fk, pk, label_col = DimClient, FactVideos.client_id, DimClient.client_id, DimClient.client_name
    elif breakdown == "channel":
        from app.models.dim_channel import DimChannel
        model, fk, pk, label_col = DimChannel, FactVideos.channel_id, DimChannel.channel_id, DimChannel.channel_name
    else:
        from app.models.dim_user import DimUser
        model, fk, pk, label_col = DimUser, FactVideos.user_id, DimUser.user_id, DimUser.username

    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date)

    rows = (
        q.join(model, fk == pk)
        .with_entities(
            label_col.label("name"),
            func.count(FactVideos.video_id).label("uploaded"),
            func.count().filter(FactVideos.is_processed == True).label("processed"),
            func.count().filter(FactVideos.is_published == True).label("published"),
        )
        .group_by(label_col)
        .order_by(func.count(FactVideos.video_id).desc())
        .all()
    )

    return {
        "breakdown": breakdown,
        "entries": [
            {
                "name": r.name,
                "uploaded": r.uploaded,
                "processing_rate": round(r.processed / r.uploaded * 100, 1) if r.uploaded else 0,
                "publish_rate": round(r.published / r.uploaded * 100, 1) if r.uploaded else 0,
            }
            for r in rows
        ],
    }


@router.get("/type-mix")
def get_type_mix(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
):
    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date, client_id=client_id)

    # output type distribution
    output_rows = (
        q.join(DimType, FactVideos.type_id == DimType.type_id)
        .with_entities(
            DimType.output_type.label("type"),
            func.count(FactVideos.video_id).label("count"),
        )
        .group_by(DimType.output_type)
        .order_by(func.count(FactVideos.video_id).desc())
        .all()
    )

    # input type distribution
    input_rows = (
        q.join(DimType, FactVideos.type_id == DimType.type_id)
        .with_entities(
            DimType.input_type.label("type"),
            func.count(FactVideos.video_id).label("count"),
        )
        .group_by(DimType.input_type)
        .order_by(func.count(FactVideos.video_id).desc())
        .all()
    )

    total = sum(r.count for r in output_rows) or 1

    return {
        "output_types": [
            {"type": r.type, "count": r.count, "pct": round(r.count / total * 100, 1)}
            for r in output_rows
        ],
        "input_types": [
            {"type": r.type, "count": r.count, "pct": round(r.count / total * 100, 1)}
            for r in input_rows
        ],
    }
