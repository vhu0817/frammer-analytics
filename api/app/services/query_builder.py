from datetime import date, datetime
from typing import Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session, Query

from app.models.fact_videos import FactVideos
from app.middleware.rbac import CurrentUser


def scoped_query(db: Session, user: CurrentUser) -> Query:
    """starting point for every dashboard query. returns a SQLAlchemy query
    on fact_videos that's already filtered based on the user's role:

    - website_admin: sees everything (no filter)
    - client_admin: sees only their client's data
    - user: sees only videos they personally uploaded

    every route in phase 4 will call this instead of db.query(FactVideos)
    directly, so tenant isolation happens in one place."""

    q = db.query(FactVideos)

    if user.role == "client_admin":
        q = q.filter(FactVideos.client_id == user.client_id)
    elif user.role == "user":
        q = q.filter(FactVideos.user_id == user.user_id)
    # website_admin gets the unfiltered query

    return q


def apply_filters(
    query: Query,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    client_id: Optional[int] = None,
    channel_id: Optional[int] = None,
    user_id: Optional[int] = None,
    type_id: Optional[int] = None,
    platform_id: Optional[int] = None,
) -> Query:
    """stacks additional filters on top of the scoped query.
    only applies a filter if the value is actually provided,
    so the frontend can send as many or as few filters as it wants."""

    if start_date:
        query = query.filter(FactVideos.uploaded_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(FactVideos.uploaded_at <= datetime.combine(end_date, datetime.max.time()))
    if client_id:
        query = query.filter(FactVideos.client_id == client_id)
    if channel_id:
        query = query.filter(FactVideos.channel_id == channel_id)
    if user_id:
        query = query.filter(FactVideos.user_id == user_id)
    if type_id:
        query = query.filter(FactVideos.type_id == type_id)
    if platform_id:
        query = query.filter(FactVideos.platform_id == platform_id)

    return query
