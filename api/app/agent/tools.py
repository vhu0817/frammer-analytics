"""
Tool implementations for the ATLAS AI agent.

Each tool is a function that takes parsed arguments and returns a result
string that gets injected back into the conversation as an "Observation".

The 5 tools:
  1. execute_query — run read-only SQL, return JSON rows
  2. build_chart   — package data into a frontend-renderable chart config
  3. get_schema    — return the database schema description
  4. get_metric_definitions — return business metric formulas
  5. answer        — provide the final natural language answer (terminates loop)

Security:
  - execute_query blocks all DML/DDL keywords before running
  - queries run with a statement_timeout to prevent long-running scans
  - results are capped at 100 rows to prevent memory issues
"""

import re
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


# ── SQL Safety ──────────────────────────────────────────────

# keywords that should NEVER appear in agent-generated SQL
BLOCKED_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|"
    r"EXEC|EXECUTE|INTO\s+OUTFILE|LOAD_FILE|COPY)\b",
    re.IGNORECASE,
)

# max rows returned from any query
MAX_ROWS = 100

# query timeout in milliseconds (10 seconds)
QUERY_TIMEOUT_MS = 10_000


def _validate_sql(sql: str) -> None:
    """
    Check that SQL is safe to execute. Raises ValueError if not.

    We check for DML/DDL keywords. This isn't foolproof (a determined
    attacker could bypass it), but the agent is the only caller — this
    is defense-in-depth against prompt injection, not a security boundary.
    """
    # strip comments that might hide keywords
    cleaned = re.sub(r"--.*$", "", sql, flags=re.MULTILINE)
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)

    if BLOCKED_KEYWORDS.search(cleaned):
        raise ValueError(
            f"Query contains blocked keyword. Only SELECT queries are allowed."
        )

    # must start with SELECT or WITH (for CTEs)
    stripped = cleaned.strip().upper()
    if not stripped.startswith(("SELECT", "WITH")):
        raise ValueError(
            "Query must start with SELECT or WITH. Got: "
            f"{stripped[:30]}..."
        )


# ── Tool Implementations ───────────────────────────────────

def execute_query(db: Session, args: dict) -> dict:
    """
    Run a read-only SQL query and return the results as JSON rows.

    Args (from the LLM):
        sql (str): A SELECT query to execute.

    Returns:
        {"success": True, "rows": [...], "row_count": N}
        or {"success": False, "error": "..."}
    """
    sql = args.get("sql", "").strip()
    if not sql:
        return {"success": False, "error": "No SQL query provided."}

    try:
        _validate_sql(sql)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    # add LIMIT if the query doesn't already have one
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip(";") + f" LIMIT {MAX_ROWS}"

    try:
        # set a per-statement timeout so a bad query can't hang the server
        db.execute(text(f"SET LOCAL statement_timeout = {QUERY_TIMEOUT_MS}"))
        result = db.execute(text(sql))

        # convert rows to list of dicts
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchall()]

        return {
            "success": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
        }

    except Exception as e:
        # rollback the failed transaction so the session stays usable
        db.rollback()
        error_msg = str(e).split("\n")[0]  # first line only, no stack trace
        return {"success": False, "error": f"SQL error: {error_msg}"}


def build_chart(args: dict) -> dict:
    """
    Package data into a chart config that the frontend can render with Recharts.

    Args (from the LLM):
        chart_type (str): "bar", "line", "area", "pie", "donut", "radar"
        title (str): Chart title
        data (list): Data rows (from execute_query results)
        x_key (str): Field name for x-axis / labels
        y_keys (list): Field name(s) for y-axis values
        colors (list, optional): Hex colors for each y_key

    Returns:
        {"success": True, "chart": {chart config}}
    """
    chart_type = args.get("chart_type", "bar")
    title = args.get("title", "Chart")
    data = args.get("data", [])
    x_key = args.get("x_key", "")
    y_keys = args.get("y_keys", [])
    colors = args.get("colors", None)

    # default color palette if none provided
    if not colors:
        colors = [
            "#3b82f6",  # blue
            "#10b981",  # emerald
            "#f59e0b",  # amber
            "#ef4444",  # red
            "#8b5cf6",  # violet
            "#06b6d4",  # cyan
            "#f97316",  # orange
            "#ec4899",  # pink
        ]

    valid_types = {"bar", "line", "area", "pie", "donut", "radar"}
    if chart_type not in valid_types:
        chart_type = "bar"

    chart = {
        "chart_type": chart_type,
        "title": title,
        "data": data,
        "x_key": x_key,
        "y_keys": y_keys,
        "colors": colors[:len(y_keys)] if y_keys else colors,
    }

    return {"success": True, "chart": chart}


def get_schema(args: dict) -> dict:
    """
    Return the database schema as a text description.
    The agent can call this mid-conversation if it needs to
    refresh its memory about table structures.

    Args: none (args dict is ignored)

    Returns:
        {"success": True, "schema": "..."}
    """
    schema = """
## Database Schema (Star Schema — PostgreSQL)

### fact_videos (~14,000 rows)
- video_id (PK), client_id (FK), channel_id (FK), user_id (FK), type_id (FK), platform_id (FK, nullable)
- uploaded_at (TIMESTAMP), processed_at (TIMESTAMP, nullable), published_at (TIMESTAMP, nullable)
- duration_seconds (FLOAT), is_processed (BOOL), is_published (BOOL), title (VARCHAR, nullable)

### dim_client (8 rows)
- client_id (PK), client_name, client_segment (enterprise/mid-market/startup), region

### dim_channel (28 rows)
- channel_id (PK), client_id (FK), channel_name, workspace, language

### dim_user (44 rows)
- user_id (PK), client_id (FK), username, email, team_name, role

### dim_type (31 rows)
- type_id (PK), input_type, output_type

### dim_platform (5 rows)
- platform_id (PK), platform_name (YouTube/Instagram/LinkedIn/TikTok/X)

### Joins
All dimension tables join to fact_videos via their _id columns.
Example: fact_videos JOIN dim_client USING (client_id)
"""
    return {"success": True, "schema": schema.strip()}


def get_metric_definitions(args: dict) -> dict:
    """
    Return the standard business metric definitions.
    Useful when the agent isn't sure how to calculate a specific KPI.

    Args: none (args dict is ignored)

    Returns:
        {"success": True, "metrics": "..."}
    """
    metrics = """
## Metric Definitions

| Metric | Formula |
|--------|---------|
| Total uploads | COUNT(*) FROM fact_videos |
| Processing rate | COUNT(*) FILTER (WHERE is_processed) / COUNT(*) × 100 |
| Publish rate | COUNT(*) FILTER (WHERE is_published) / COUNT(*) × 100 |
| Total hours processed | SUM(duration_seconds) FILTER (WHERE is_processed) / 3600 |
| Avg processing time | AVG(processed_at - uploaded_at) WHERE processed_at IS NOT NULL |
| Avg time to publish | AVG(published_at - processed_at) WHERE published_at IS NOT NULL |
| Drop-off (processing) | COUNT(*) FILTER (WHERE NOT is_processed) / COUNT(*) |
| Drop-off (publishing) | COUNT(*) FILTER (WHERE is_processed AND NOT is_published) / COUNT(*) FILTER (WHERE is_processed) |

### Notes
- Duration is in seconds — divide by 3600 for hours
- Timestamps are PostgreSQL TIMESTAMP type — use EXTRACT(EPOCH FROM ...) for interval math
- ~5% of titles are NULL (intentional data quality issue)
- platform_id is NULL for unpublished videos
"""
    return {"success": True, "metrics": metrics.strip()}


def answer(args: dict) -> dict:
    """
    Provide the final natural language answer. This terminates the ReAct loop.

    Args (from the LLM):
        text (str): The answer in markdown format.

    Returns:
        {"success": True, "answer": "...", "is_final": True}
    """
    text = args.get("text", "I wasn't able to generate an answer.")
    return {"success": True, "answer": text, "is_final": True}


# ── Tool Registry ──────────────────────────────────────────

# maps tool names (as referenced in the system prompt) to their functions.
# execute_query needs a db session, so it's handled specially in the ReAct loop.
TOOL_REGISTRY = {
    "execute_query": execute_query,        # needs (db, args)
    "build_chart": build_chart,            # needs (args)
    "get_schema": get_schema,              # needs (args)
    "get_metric_definitions": get_metric_definitions,  # needs (args)
    "answer": answer,                      # needs (args)
}

# tools that need a database session passed as first arg
DB_TOOLS = {"execute_query"}
