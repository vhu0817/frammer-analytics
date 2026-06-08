from fastapi import APIRouter

router = APIRouter()


@router.get("/options")
def get_filter_options():
    return {"status": "not implemented"}
