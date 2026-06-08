from fastapi import APIRouter

router = APIRouter()


@router.get("/stages")
def get_stages():
    return {"status": "not implemented"}


@router.get("/conversion")
def get_conversion():
    return {"status": "not implemented"}


@router.get("/type-mix")
def get_type_mix():
    return {"status": "not implemented"}
