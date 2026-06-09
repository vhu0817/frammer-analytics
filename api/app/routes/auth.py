from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.register_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.authenticate_user(db, data.email, data.password)
    except ValueError as e:
        # don't tell them which part was wrong (email vs password)
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserResponse)
def me(db: Session = Depends(get_db), token: str = Depends(auth_service.extract_token)):
    try:
        user = auth_service.get_current_user(db, token)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception:
        raise HTTPException(status_code=401, detail="invalid or expired token")
