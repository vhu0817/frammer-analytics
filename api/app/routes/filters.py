from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.models.dim_client import DimClient
from app.models.dim_channel import DimChannel
from app.models.dim_user import DimUser
from app.models.dim_type import DimType
from app.models.dim_platform import DimPlatform

router = APIRouter()


@router.get("/options")
def get_filter_options(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # clients — website_admin sees all, everyone else sees only theirs
    if user.role == "website_admin":
        clients = db.query(DimClient).order_by(DimClient.client_name).all()
    else:
        clients = db.query(DimClient).filter(DimClient.client_id == user.client_id).all()

    # grab the client ids this user can see, used to scope channels + users
    visible_client_ids = [c.client_id for c in clients]

    # channels — scoped to visible clients
    channels_q = db.query(DimChannel).filter(DimChannel.client_id.in_(visible_client_ids))
    channels = channels_q.order_by(DimChannel.channel_name).all()

    # users — scoped the same way, but a regular "user" only sees themselves
    if user.role == "user":
        users = db.query(DimUser).filter(DimUser.user_id == user.user_id).all()
    else:
        users = (
            db.query(DimUser)
            .filter(DimUser.client_id.in_(visible_client_ids))
            .order_by(DimUser.username)
            .all()
        )

    # types and platforms aren't tied to any client, everyone sees the full list
    types = db.query(DimType).order_by(DimType.input_type, DimType.output_type).all()
    platforms = db.query(DimPlatform).order_by(DimPlatform.platform_name).all()

    return {
        "clients": [
            {"id": c.client_id, "name": c.client_name, "segment": c.client_segment, "region": c.region}
            for c in clients
        ],
        "channels": [
            {"id": ch.channel_id, "name": ch.channel_name, "client_id": ch.client_id, "language": ch.language}
            for ch in channels
        ],
        "users": [
            {"id": u.user_id, "name": u.username, "client_id": u.client_id, "team": u.team_name}
            for u in users
        ],
        "types": [
            {"id": t.type_id, "input_type": t.input_type, "output_type": t.output_type}
            for t in types
        ],
        "platforms": [
            {"id": p.platform_id, "name": p.platform_name}
            for p in platforms
        ],
    }
