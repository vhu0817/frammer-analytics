"""
Data Quality Monitoring route.

Provides a comprehensive health check of the data in the star schema:
  - Missing/null value counts per key field
  - "Unknown" bucket tracking (placeholder values in dimensions)
  - Duplicate video ID detection
  - Orphaned foreign key detection
  - Overall data quality score

This is a governance tool — it answers "how clean is our data?"
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, case, or_, literal
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.fact_videos import FactVideos
from app.models.dim_client import DimClient
from app.models.dim_channel import DimChannel
from app.models.dim_user import DimUser
from app.models.dim_type import DimType
from app.models.dim_platform import DimPlatform

router = APIRouter()


@router.get("/report")
def get_data_quality_report(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a full data quality report with:
    - total_records: total rows in fact_videos
    - missing_values: counts of NULL/empty values per key field
    - unknown_buckets: counts of "Unknown" placeholder values in dimensions
    - duplicates: any duplicate video IDs (should be 0)
    - orphaned_fks: foreign keys pointing to non-existent dimension rows
    - quality_score: 0-100 overall score
    """

    # ── 1. Total records ──
    total = db.query(func.count(FactVideos.video_id)).scalar() or 0

    if total == 0:
        return {
            "total_records": 0,
            "missing_values": [],
            "unknown_buckets": [],
            "duplicates": {"count": 0, "sample_ids": []},
            "orphaned_fks": [],
            "quality_score": 100,
        }

    # ── 2. Missing/null values per field ──
    missing_row = db.query(
        func.count(case((FactVideos.title == None, 1))).label("title"),
        func.count(case((FactVideos.title == "", 1))).label("title_empty"),
        func.count(case((FactVideos.processed_at == None, 1))).label("processed_at"),
        func.count(case((FactVideos.published_at == None, 1))).label("published_at"),
        func.count(case((FactVideos.platform_id == None, 1))).label("platform_id"),
        func.count(case((FactVideos.duration_seconds == 0, 1))).label("duration_zero"),
    ).one()

    missing_values = [
        {
            "field": "title",
            "null_count": missing_row.title,
            "empty_count": missing_row.title_empty,
            "total": missing_row.title + missing_row.title_empty,
            "pct": round((missing_row.title + missing_row.title_empty) / total * 100, 1),
        },
        {
            "field": "processed_at",
            "null_count": missing_row.processed_at,
            "empty_count": 0,
            "total": missing_row.processed_at,
            "pct": round(missing_row.processed_at / total * 100, 1),
        },
        {
            "field": "published_at",
            "null_count": missing_row.published_at,
            "empty_count": 0,
            "total": missing_row.published_at,
            "pct": round(missing_row.published_at / total * 100, 1),
        },
        {
            "field": "platform_id",
            "null_count": missing_row.platform_id,
            "empty_count": 0,
            "total": missing_row.platform_id,
            "pct": round(missing_row.platform_id / total * 100, 1),
        },
        {
            "field": "duration_seconds",
            "null_count": 0,
            "empty_count": missing_row.duration_zero,
            "total": missing_row.duration_zero,
            "pct": round(missing_row.duration_zero / total * 100, 1),
        },
    ]

    # ── 3. "Unknown" bucket tracking ──
    # Check if any dimension values contain "Unknown" or similar placeholders
    unknown_client = db.query(func.count(FactVideos.video_id)).join(
        DimClient, FactVideos.client_id == DimClient.client_id
    ).filter(
        or_(
            DimClient.client_name.ilike("%unknown%"),
            DimClient.client_name.ilike("%test%"),
            DimClient.client_name == "",
        )
    ).scalar() or 0

    unknown_channel = db.query(func.count(FactVideos.video_id)).join(
        DimChannel, FactVideos.channel_id == DimChannel.channel_id
    ).filter(
        or_(
            DimChannel.channel_name.ilike("%unknown%"),
            DimChannel.channel_name.ilike("%test%"),
            DimChannel.channel_name == "",
        )
    ).scalar() or 0

    unknown_user = db.query(func.count(FactVideos.video_id)).join(
        DimUser, FactVideos.user_id == DimUser.user_id
    ).filter(
        or_(
            DimUser.username.ilike("%unknown%"),
            DimUser.username == "",
        )
    ).scalar() or 0

    unknown_type = db.query(func.count(FactVideos.video_id)).join(
        DimType, FactVideos.type_id == DimType.type_id
    ).filter(
        or_(
            DimType.input_type.ilike("%unknown%"),
            DimType.output_type.ilike("%unknown%"),
            DimType.input_type == "",
            DimType.output_type == "",
        )
    ).scalar() or 0

    unknown_buckets = [
        {"dimension": "client", "count": unknown_client, "pct": round(unknown_client / total * 100, 1)},
        {"dimension": "channel", "count": unknown_channel, "pct": round(unknown_channel / total * 100, 1)},
        {"dimension": "user", "count": unknown_user, "pct": round(unknown_user / total * 100, 1)},
        {"dimension": "type", "count": unknown_type, "pct": round(unknown_type / total * 100, 1)},
    ]

    # ── 4. Duplicate video ID detection ──
    # video_id is a primary key so true duplicates are impossible,
    # but we check for duplicate titles (same title uploaded multiple times)
    dup_title_count = 0
    dup_sample = []
    dup_query = db.query(
        FactVideos.title,
        func.count(FactVideos.video_id).label("cnt"),
    ).filter(
        FactVideos.title != None,
        FactVideos.title != "",
    ).group_by(FactVideos.title).having(
        func.count(FactVideos.video_id) > 1
    ).order_by(func.count(FactVideos.video_id).desc()).limit(5).all()

    dup_title_count = len(dup_query)
    dup_sample = [{"title": r.title, "count": r.cnt} for r in dup_query]

    # ── 5. Orphaned foreign keys ──
    # Videos referencing dimension IDs that don't exist
    orphan_client = db.query(func.count(FactVideos.video_id)).outerjoin(
        DimClient, FactVideos.client_id == DimClient.client_id
    ).filter(DimClient.client_id == None).scalar() or 0

    orphan_channel = db.query(func.count(FactVideos.video_id)).outerjoin(
        DimChannel, FactVideos.channel_id == DimChannel.channel_id
    ).filter(DimChannel.channel_id == None).scalar() or 0

    orphaned_fks = [
        {"dimension": "client", "orphaned_count": orphan_client},
        {"dimension": "channel", "orphaned_count": orphan_channel},
    ]

    # ── 6. Quality score ──
    # Weighted scoring:
    #   - 40% from missing values (fewer = better)
    #   - 30% from unknown buckets (fewer = better)
    #   - 20% from orphaned FKs (zero = full marks)
    #   - 10% from duplicate titles (fewer = better)

    # missing penalty: average missing % across fields
    avg_missing_pct = sum(m["pct"] for m in missing_values) / len(missing_values) if missing_values else 0
    missing_score = max(0, 100 - avg_missing_pct * 2)  # 50% missing = 0 score

    # unknown penalty
    total_unknown = sum(u["count"] for u in unknown_buckets)
    unknown_pct = total_unknown / total * 100 if total > 0 else 0
    unknown_score = max(0, 100 - unknown_pct * 5)

    # orphan penalty
    total_orphans = sum(o["orphaned_count"] for o in orphaned_fks)
    orphan_score = 100 if total_orphans == 0 else max(0, 100 - (total_orphans / total * 100) * 10)

    # duplicate penalty
    dup_score = 100 if dup_title_count == 0 else max(0, 100 - dup_title_count * 5)

    quality_score = round(
        missing_score * 0.4 +
        unknown_score * 0.3 +
        orphan_score * 0.2 +
        dup_score * 0.1,
        1
    )

    # ── 7. Field completeness summary ──
    completeness = []
    fields_to_check = [
        ("video_id", 0),
        ("client_id", 0),
        ("channel_id", 0),
        ("user_id", 0),
        ("type_id", 0),
        ("uploaded_at", 0),
        ("duration_seconds", missing_row.duration_zero),
    ]
    for field, bad_count in fields_to_check:
        completeness.append({
            "field": field,
            "complete": total - bad_count,
            "total": total,
            "pct": round((total - bad_count) / total * 100, 1),
        })
    # add nullable fields
    nullable_fields = [
        ("title", missing_row.title + missing_row.title_empty),
        ("processed_at", missing_row.processed_at),
        ("published_at", missing_row.published_at),
        ("platform_id", missing_row.platform_id),
    ]
    for field, bad_count in nullable_fields:
        completeness.append({
            "field": field,
            "complete": total - bad_count,
            "total": total,
            "pct": round((total - bad_count) / total * 100, 1),
        })

    return {
        "total_records": total,
        "missing_values": missing_values,
        "unknown_buckets": unknown_buckets,
        "duplicates": {
            "duplicate_titles": dup_title_count,
            "sample": dup_sample,
        },
        "orphaned_fks": orphaned_fks,
        "completeness": completeness,
        "quality_score": quality_score,
    }
