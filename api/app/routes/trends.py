from fastapi import APIRouter

router = APIRouter()


@router.get("/timeseries")
def get_timeseries():
    return {"status": "not implemented"}


@router.get("/comparison")
def get_comparison():
    return {"status": "not implemented"}
