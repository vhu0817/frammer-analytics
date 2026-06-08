from fastapi import APIRouter

router = APIRouter()


@router.get("/kpis")
def get_kpis():
    return {"status": "not implemented"}


@router.get("/sparklines")
def get_sparklines():
    return {"status": "not implemented"}


@router.get("/alerts")
def get_alerts():
    return {"status": "not implemented"}
