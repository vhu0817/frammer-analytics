from fastapi import APIRouter

router = APIRouter()


@router.post("/login")
def login():
    return {"status": "not implemented"}


@router.post("/register")
def register():
    return {"status": "not implemented"}


@router.get("/me")
def me():
    return {"status": "not implemented"}
