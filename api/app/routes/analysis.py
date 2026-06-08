from fastapi import APIRouter

router = APIRouter()


@router.get("/pivot")
def get_pivot():
    return {"status": "not implemented"}


@router.get("/leaderboard")
def get_leaderboard():
    return {"status": "not implemented"}


@router.get("/drilldown")
def get_drilldown():
    return {"status": "not implemented"}
