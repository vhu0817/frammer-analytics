from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.fact_videos import FactVideos
from app.services.query_builder import scoped_query, apply_filters

router = APIRouter()


@router.get("/kpis")
def get_kpis(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    type_id: Optional[int] = None,
):
    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date,
                       client_id=client_id, channel_id=channel_id, type_id=type_id)

    # all KPIs in one query so we don't do 4 separate round trips to the db
    row = q.with_entities(
        func.count(FactVideos.video_id).label("total_uploaded"),
        func.count().filter(FactVideos.is_processed == True).label("total_processed"),
        func.count().filter(FactVideos.is_published == True).label("total_published"),
        func.coalesce(func.sum(FactVideos.duration_seconds), 0).label("total_duration_seconds"),
    ).one()

    total_uploaded = row.total_uploaded
    total_processed = row.total_processed
    total_published = row.total_published

    return {
        "total_uploaded": total_uploaded,
        "total_processed": total_processed,
        "total_published": total_published,
        "total_duration_hours": round(row.total_duration_seconds / 3600, 1),
        "processing_rate": round(total_processed / total_uploaded * 100, 1) if total_uploaded else 0,
        "publish_rate": round(total_published / total_uploaded * 100, 1) if total_uploaded else 0,
    }


@router.get("/sparklines")
def get_sparklines(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=7, le=90),
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
):
    cutoff = datetime.utcnow() - timedelta(days=days)

    q = scoped_query(db, user)
    q = apply_filters(q, client_id=client_id, channel_id=channel_id)
    q = q.filter(FactVideos.uploaded_at >= cutoff)

    # group by calendar day, get counts for each metric
    day_col = cast(FactVideos.uploaded_at, Date).label("day")
    daily = (
        q.with_entities(
            day_col,
            func.count(FactVideos.video_id).label("uploaded"),
            func.count().filter(FactVideos.is_processed == True).label("processed"),
            func.count().filter(FactVideos.is_published == True).label("published"),
            func.coalesce(func.sum(FactVideos.duration_seconds), 0).label("duration_seconds"),
        )
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )

    return {
        "days": [str(r.day) for r in daily],
        "uploaded": [r.uploaded for r in daily],
        "processed": [r.processed for r in daily],
        "published": [r.published for r in daily],
        "duration_hours": [round(r.duration_seconds / 3600, 2) for r in daily],
    }


@router.get("/alerts")
def get_alerts(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    client_id: Optional[int] = None,
):
    # look at the last 30 days and flag any day where upload count
    # deviates more than 2 standard deviations from the mean
    cutoff = datetime.utcnow() - timedelta(days=30)

    q = scoped_query(db, user)
    q = apply_filters(q, client_id=client_id)
    q = q.filter(FactVideos.uploaded_at >= cutoff)

    day_col = cast(FactVideos.uploaded_at, Date).label("day")
    daily = (
        q.with_entities(day_col, func.count(FactVideos.video_id).label("count"))
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )

    if len(daily) < 3:
        return {"alerts": [], "message": "not enough data for anomaly detection"}

    counts = [r.count for r in daily]
    mean = sum(counts) / len(counts)
    variance = sum((c - mean) ** 2 for c in counts) / len(counts)
    std = variance ** 0.5

    if std == 0:
        return {"alerts": [], "message": "no variance in daily counts"}

    alerts = []
    for r in daily:
        z_score = (r.count - mean) / std
        if abs(z_score) >= 2.0:
            direction = "spike" if z_score > 0 else "drop"
            alerts.append({
                "date": str(r.day),
                "count": r.count,
                "z_score": round(z_score, 2),
                "type": direction,
                "message": f"unusual {direction}: {r.count} uploads vs {round(mean, 1)} avg",
            })

    return {
        "alerts": alerts,
        "stats": {
            "mean_daily_uploads": round(mean, 1),
            "std_dev": round(std, 1),
            "days_analyzed": len(daily),
        },
    }
