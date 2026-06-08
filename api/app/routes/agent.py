from fastapi import APIRouter

router = APIRouter()


@router.post("/query")
def query_agent():
    return {"status": "not implemented"}
