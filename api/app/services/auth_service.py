from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.dim_user import DimUser
from app.schemas.auth import RegisterRequest, UserResponse, TokenResponse


def hash_password(plain: str) -> str:
    # bcrypt wants bytes, not str
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user: DimUser) -> str:
    # stuff we'll need on every authenticated request without hitting the db
    payload = {
        "sub": user.user_id,
        "client_id": user.client_id,
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    # raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on bad tokens
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def register_user(db: Session, data: RegisterRequest) -> TokenResponse:
    # check if someone already signed up with this email
    existing = db.query(DimUser).filter(DimUser.email == data.email).first()
    if existing:
        raise ValueError("email already registered")

    user = DimUser(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        client_id=data.client_id,
        team_name=data.team_name,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


def authenticate_user(db: Session, email: str, password: str) -> TokenResponse:
    user = db.query(DimUser).filter(DimUser.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("invalid email or password")

    token = create_token(user)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


def get_current_user(db: Session, token: str) -> DimUser:
    payload = decode_token(token)
    user = db.query(DimUser).filter(DimUser.user_id == payload["sub"]).first()
    if not user:
        raise ValueError("user not found")
    return user


def extract_token(authorization: str = Header(None)) -> str:
    # pull the token out of "Bearer <token>" header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing or bad authorization header")
    return authorization.split(" ", 1)[1]

