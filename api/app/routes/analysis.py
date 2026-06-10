from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
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

# maps dimension names to (model, fk on fact_videos, label column)
# so the frontend just sends "client" or "channel" as a string
DIMENSION_MAP = {
    "client":   (DimClient,   FactVideos.client_id,   DimClient.client_id,   DimClient.client_name),
    "channel":  (DimChannel,  FactVideos.channel_id,  DimChannel.channel_id, DimChannel.channel_name),
    "user":     (DimUser,     FactVideos.user_id,     DimUser.user_id,       DimUser.username),
    "type":     (DimType,     FactVideos.type_id,     DimType.type_id,       DimType.output_type),
    "platform": (DimPlatform, FactVideos.platform_id, DimPlatform.platform_id, DimPlatform.platform_name),
}

VALID_DIMS = "^(client|channel|user|type|platform)$"
VALID_METRICS = "^(uploaded|processed|published|duration)$"


def _build_metric_agg(metric: str):
    if metric == "processed":
        return func.count().filter(FactVideos.is_processed == True).label("value")
    elif metric == "published":
        return func.count().filter(FactVideos.is_published == True).label("value")
    elif metric == "duration":
        return func.coalesce(func.sum(FactVideos.duration_seconds) / 3600, 0).label("value")
    return func.count(FactVideos.video_id).label("value")


@router.get("/pivot")
def get_pivot(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    dim1: str = Query(default="client", regex=VALID_DIMS),
    dim2: str = Query(default="channel", regex=VALID_DIMS),
    metric: str = Query(default="uploaded", regex=VALID_METRICS),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    if dim1 == dim2:
        return {"error": "dim1 and dim2 must be different"}

    model1, fk1, pk1, label1 = DIMENSION_MAP[dim1]
    model2, fk2, pk2, label2 = DIMENSION_MAP[dim2]

    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date)

    agg = _build_metric_agg(metric)

    # join both dimension tables so we can group by their labels
    rows = (
        q.join(model1, fk1 == pk1)
        .join(model2, fk2 == pk2)
        .with_entities(label1.label("dim1_label"), label2.label("dim2_label"), agg)
        .group_by(label1, label2)
        .order_by(label1, label2)
        .all()
    )

    # reshape into a pivot-friendly format
    # {dim1_values: [], dim2_values: [], matrix: [[...]]}
    dim1_values = sorted(set(r.dim1_label for r in rows))
    dim2_values = sorted(set(r.dim2_label for r in rows))

    # build a lookup so we can fill the matrix quickly
    lookup = {(r.dim1_label, r.dim2_label): round(float(r.value), 2) for r in rows}
    matrix = [
        [lookup.get((d1, d2), 0) for d2 in dim2_values]
        for d1 in dim1_values
    ]

    return {
        "dim1": dim1,
        "dim2": dim2,
        "metric": metric,
        "dim1_values": dim1_values,
        "dim2_values": dim2_values,
        "matrix": matrix,
    }


@router.get("/leaderboard")
def get_leaderboard(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    dimension: str = Query(default="client", regex=VALID_DIMS),
    metric: str = Query(default="uploaded", regex=VALID_METRICS),
    top_n: int = Query(default=10, ge=1, le=50),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    model, fk, pk, label_col = DIMENSION_MAP[dimension]

    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date)

    agg = _build_metric_agg(metric)

    rows = (
        q.join(model, fk == pk)
        .with_entities(label_col.label("name"), agg)
        .group_by(label_col)
        .order_by(agg.desc())
        .limit(top_n)
        .all()
    )

    return {
        "dimension": dimension,
        "metric": metric,
        "entries": [
            {"name": r.name, "value": round(float(r.value), 2)}
            for r in rows
        ],
    }


@router.get("/drilldown")
def get_drilldown(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    dimension: str = Query(regex=VALID_DIMS),
    value: str = Query(),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    model, fk, pk, label_col = DIMENSION_MAP[dimension]

    q = scoped_query(db, user)
    q = apply_filters(q, start_date=start_date, end_date=end_date)

    # filter to the specific dimension value
    q = q.join(model, fk == pk).filter(label_col == value)

    # get all the KPIs for this specific slice
    row = q.with_entities(
        func.count(FactVideos.video_id).label("total_uploaded"),
        func.count().filter(FactVideos.is_processed == True).label("total_processed"),
        func.count().filter(FactVideos.is_published == True).label("total_published"),
        func.coalesce(func.sum(FactVideos.duration_seconds) / 3600, 0).label("total_duration_hours"),
    ).one()

    total_uploaded = row.total_uploaded

    return {
        "dimension": dimension,
        "value": value,
        "total_uploaded": total_uploaded,
        "total_processed": row.total_processed,
        "total_published": row.total_published,
        "total_duration_hours": round(float(row.total_duration_hours), 1),
        "processing_rate": round(row.total_processed / total_uploaded * 100, 1) if total_uploaded else 0,
        "publish_rate": round(row.total_published / total_uploaded * 100, 1) if total_uploaded else 0,
    }
