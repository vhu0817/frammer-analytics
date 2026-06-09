from dataclasses import dataclass

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import extract_token, decode_token


@dataclass
class CurrentUser:
    """lightweight container for the jwt payload so dashboard routes
    don't need to hit the db on every single request — user_id, client_id,
    and role are already in the token."""
    user_id: int
    client_id: int
    role: str


def get_current_user(
    token: str = Depends(extract_token),
) -> CurrentUser:
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid or expired token")

    return CurrentUser(
        user_id=payload["sub"],
        client_id=payload["client_id"],
        role=payload["role"],
    )


def require_role(*allowed_roles: str):
    """use this when a route should only be accessible to certain roles.
    example: Depends(require_role("website_admin", "client_admin"))"""

    def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"this endpoint requires one of: {', '.join(allowed_roles)}",
            )
        return user

    return checker
