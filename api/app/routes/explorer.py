from fastapi import APIRouter

router = APIRouter()


@router.get("/videos")
def get_videos():
    return {"status": "not implemented"}


@router.get("/export")
def export_csv():
    return {"status": "not implemented"}
