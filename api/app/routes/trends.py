from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, cast, Date, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.fact_videos import FactVideos
from app.services.query_builder import scoped_query, apply_filters

router = APIRouter()

# postgres date_trunc accepts these, we just need to validate the input
VALID_GRANULARITIES = {"day", "week", "month"}


@router.get("/timeseries")
def get_timeseries(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    granularity: str = Query(default="day", regex="^(day|week|month)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    type_id: Optional[int] = None,
    metric: str = Query(default="uploaded", regex="^(uploaded|processed|published|duration)$"),
):
    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date,
                       client_id=client_id, channel_id=channel_id, type_id=type_id)

    # date_trunc('week', uploaded_at) groups timestamps into buckets
    bucket = func.date_trunc(granularity, FactVideos.uploaded_at).label("bucket")

    # pick which metric to aggregate
    if metric == "processed":
        agg = func.count().filter(FactVideos.is_processed == True).label("value")
    elif metric == "published":
        agg = func.count().filter(FactVideos.is_published == True).label("value")
    elif metric == "duration":
        agg = func.coalesce(func.sum(FactVideos.duration_seconds) / 3600, 0).label("value")
    else:
        agg = func.count(FactVideos.video_id).label("value")

    rows = (
        q.with_entities(bucket, agg)
        .group_by(bucket)
        .order_by(bucket)
        .all()
    )

    return {
        "granularity": granularity,
        "metric": metric,
        "labels": [str(r.bucket.date()) if hasattr(r.bucket, 'date') else str(r.bucket) for r in rows],
        "values": [round(float(r.value), 2) for r in rows],
    }


@router.get("/comparison")
def get_comparison(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=7, le=180),
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    metric: str = Query(default="uploaded", regex="^(uploaded|processed|published|duration)$"),
):
    now = datetime.utcnow()
    current_start = now - timedelta(days=days)
    previous_start = current_start - timedelta(days=days)

    def build_agg(metric_name):
        if metric_name == "processed":
            return func.count().filter(FactVideos.is_processed == True)
        elif metric_name == "published":
            return func.count().filter(FactVideos.is_published == True)
        elif metric_name == "duration":
            return func.coalesce(func.sum(FactVideos.duration_seconds) / 3600, 0)
        return func.count(FactVideos.video_id)

    agg = build_agg(metric)
    day_col = cast(FactVideos.uploaded_at, Date).label("day")

    # current period
    q_current = scoped_query(db, user)
    q_current = apply_filters(q_current, client_id=client_id, channel_id=channel_id)
    q_current = q_current.filter(FactVideos.uploaded_at >= current_start)

    current_rows = (
        q_current.with_entities(day_col, agg.label("value"))
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )

    # previous period (same length, immediately before current)
    q_previous = scoped_query(db, user)
    q_previous = apply_filters(q_previous, client_id=client_id, channel_id=channel_id)
    q_previous = q_previous.filter(
        FactVideos.uploaded_at >= previous_start,
        FactVideos.uploaded_at < current_start,
    )

    previous_rows = (
        q_previous.with_entities(day_col, agg.label("value"))
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )

    # totals for quick comparison
    current_total = sum(float(r.value) for r in current_rows)
    previous_total = sum(float(r.value) for r in previous_rows)
    change_pct = round((current_total - previous_total) / previous_total * 100, 1) if previous_total else 0

    return {
        "metric": metric,
        "days": days,
        "current": {
            "labels": [str(r.day) for r in current_rows],
            "values": [round(float(r.value), 2) for r in current_rows],
            "total": round(current_total, 2),
        },
        "previous": {
            "labels": [str(r.day) for r in previous_rows],
            "values": [round(float(r.value), 2) for r in previous_rows],
            "total": round(previous_total, 2),
        },
        "change_pct": change_pct,
    }
