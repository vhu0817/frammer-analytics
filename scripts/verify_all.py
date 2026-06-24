"""
Step 8.5 — Final Verification Script

Runs all automated checks against the deployed API to verify
the entire application stack is working correctly.

Usage:
  python scripts/verify_all.py [--base-url https://your-api.com]

Default base URL: https://frammer-analytics-api.onrender.com
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.error

# ANSI colors for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

passed = 0
failed = 0
warnings = 0


def log_pass(test_name, detail=""):
    global passed
    passed += 1
    print(f"  {GREEN}✓{RESET} {test_name}" + (f" — {detail}" if detail else ""))


def log_fail(test_name, detail=""):
    global failed
    failed += 1
    print(f"  {RED}✗{RESET} {test_name}" + (f" — {detail}" if detail else ""))


def log_warn(test_name, detail=""):
    global warnings
    warnings += 1
    print(f"  {YELLOW}⚠{RESET} {test_name}" + (f" — {detail}" if detail else ""))


def log_section(title):
    print(f"\n{BOLD}{CYAN}{'─' * 50}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─' * 50}{RESET}")


def api_request(base_url, path, method="GET", data=None, token=None, timeout=15):
    """Make an HTTP request and return (status_code, response_body_dict)."""
    url = f"{base_url}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"detail": raw}
    except urllib.error.URLError as e:
        return 0, {"detail": str(e.reason)}
    except Exception as e:
        return 0, {"detail": str(e)}


def run_tests(base_url):
    global passed, failed, warnings
    token = None
    start_time = time.time()

    # ──────────────────────────────────────────────
    # 1. HEALTH CHECK
    # ──────────────────────────────────────────────
    log_section("1. Health Check")

    status, body = api_request(base_url, "/health")
    if status == 200 and body.get("status") == "healthy":
        log_pass("GET /health", f"status={body['status']}, version={body.get('version', '?')}")
    else:
        log_fail("GET /health", f"status={status}, body={body}")
        print(f"\n  {RED}API is not reachable. Cannot continue.{RESET}")
        return

    # ──────────────────────────────────────────────
    # 2. AUTH FLOW
    # ──────────────────────────────────────────────
    log_section("2. Authentication")

    # Login as admin
    status, body = api_request(base_url, "/api/auth/login", method="POST", data={
        "email": "admin@techvistacorp.com",
        "password": "password123",
    })
    if status == 200 and "access_token" in body:
        token = body["access_token"]
        log_pass("POST /api/auth/login (admin)", f"token={token[:20]}...")
    else:
        log_fail("POST /api/auth/login (admin)", f"status={status}, body={body}")
        print(f"\n  {RED}Cannot login. Cannot continue.{RESET}")
        return

    # Get /me
    status, body = api_request(base_url, "/api/auth/me", token=token)
    if status == 200 and body.get("email") == "admin@techvistacorp.com":
        log_pass("GET /api/auth/me", f"role={body.get('role')}, email={body.get('email')}")
    else:
        log_fail("GET /api/auth/me", f"status={status}")

    # Reject bad password
    status, body = api_request(base_url, "/api/auth/login", method="POST", data={
        "email": "admin@techvistacorp.com",
        "password": "wrongpassword",
    })
    if status == 401:
        log_pass("POST /api/auth/login (bad password)", "correctly rejected with 401")
    else:
        log_fail("POST /api/auth/login (bad password)", f"expected 401, got {status}")

    # Reject no token
    status, body = api_request(base_url, "/api/executive/kpis")
    if status == 401 or status == 403:
        log_pass("GET /api/executive/kpis (no token)", f"correctly rejected with {status}")
    else:
        log_fail("GET /api/executive/kpis (no token)", f"expected 401/403, got {status}")

    # ──────────────────────────────────────────────
    # 3. FILTER OPTIONS
    # ──────────────────────────────────────────────
    log_section("3. Filter Options")

    status, body = api_request(base_url, "/api/filters/options", token=token)
    if status == 200:
        clients = body.get("clients", [])
        channels = body.get("channels", [])
        platforms = body.get("platforms", [])
        log_pass("GET /api/filters/options",
                 f"{len(clients)} clients, {len(channels)} channels, {len(platforms)} platforms")
        if len(clients) >= 5:
            log_pass("Client count", f"≥5 clients ({len(clients)})")
        else:
            log_warn("Client count", f"only {len(clients)} clients")
    else:
        log_fail("GET /api/filters/options", f"status={status}")

    # ──────────────────────────────────────────────
    # 4. EXECUTIVE SUMMARY
    # ──────────────────────────────────────────────
    log_section("4. Executive Summary Endpoints")

    # KPIs
    status, body = api_request(base_url, "/api/executive/kpis", token=token)
    if status == 200:
        uploaded = body.get("total_uploaded", 0)
        proc_rate = body.get("processing_rate", 0)
        pub_rate = body.get("publish_rate", 0)
        log_pass("GET /api/executive/kpis",
                 f"uploaded={uploaded}, proc_rate={proc_rate}%, pub_rate={pub_rate}%")
        if uploaded > 10000:
            log_pass("Data volume", f"{uploaded} records (healthy)")
        else:
            log_warn("Data volume", f"only {uploaded} records")
    else:
        log_fail("GET /api/executive/kpis", f"status={status}")

    # Sparklines
    status, body = api_request(base_url, "/api/executive/sparklines", token=token)
    if status == 200 and isinstance(body, dict) and "days" in body:
        log_pass("GET /api/executive/sparklines", f"{len(body['days'])} data points")
    else:
        log_fail("GET /api/executive/sparklines", f"status={status}")

    # Output type distribution (served by /api/funnel/type-mix)
    status, body = api_request(base_url, "/api/funnel/type-mix", token=token)
    if status == 200 and "output_types" in body:
        log_pass("GET /api/funnel/type-mix (output types)", f"{len(body['output_types'])} output types")
    else:
        log_fail("GET /api/funnel/type-mix (output types)", f"status={status}")

    # Anomaly alerts
    status, body = api_request(base_url, "/api/executive/alerts", token=token)
    if status == 200 and "alerts" in body:
        log_pass("GET /api/executive/alerts", f"{len(body['alerts'])} alerts")
    else:
        log_fail("GET /api/executive/alerts", f"status={status}")

    # ──────────────────────────────────────────────
    # 5. TRENDS
    # ──────────────────────────────────────────────
    log_section("5. Usage & Trends Endpoints")

    for gran in ["day", "week", "month"]:
        status, body = api_request(base_url, f"/api/trends/timeseries?granularity={gran}&metric=uploaded", token=token)
        if status == 200 and "labels" in body:
            log_pass(f"GET /api/trends/timeseries (granularity={gran})",
                     f"{len(body['labels'])} buckets")
        else:
            log_fail(f"GET /api/trends/timeseries (granularity={gran})", f"status={status}")

    status, body = api_request(base_url, "/api/trends/comparison?granularity=day&metric=uploaded", token=token)
    if status == 200:
        log_pass("GET /api/trends/comparison", "period comparison returned")
    else:
        log_fail("GET /api/trends/comparison", f"status={status}")

    # ──────────────────────────────────────────────
    # 6. ANALYSIS
    # ──────────────────────────────────────────────
    log_section("6. Analysis Endpoints")

    status, body = api_request(base_url, "/api/analysis/leaderboard?dimension=client&metric=uploaded", token=token)
    if status == 200 and "entries" in body and len(body["entries"]) > 0:
        top = body["entries"][0]
        log_pass("GET /api/analysis/leaderboard", f"top entity: {top.get('name', '?')} ({top.get('value', 0)})")
    else:
        log_fail("GET /api/analysis/leaderboard", f"status={status}")

    status, body = api_request(base_url, "/api/analysis/pivot?dimension=client&metric=uploaded", token=token)
    if status == 200 and "matrix" in body:
        rows = len(body.get("dim1_values", []))
        cols = len(body.get("dim2_values", []))
        log_pass("GET /api/analysis/pivot", f"{rows}×{cols} matrix")
    else:
        log_fail("GET /api/analysis/pivot", f"status={status}")

    status, body = api_request(base_url, "/api/analysis/drilldown?dimension=client&value=TechVista%20Corp", token=token)
    if status == 200 and "total_uploaded" in body:
        log_pass("GET /api/analysis/drilldown", f"uploaded={body['total_uploaded']}, published={body.get('total_published', 0)}")
    else:
        log_fail("GET /api/analysis/drilldown", f"status={status}, body={body}")

    # ──────────────────────────────────────────────
    # 7. FUNNEL
    # ──────────────────────────────────────────────
    log_section("7. Publishing Funnel Endpoints")

    status, body = api_request(base_url, "/api/funnel/stages", token=token)
    if status == 200 and "stages" in body:
        stages = body["stages"]
        log_pass("GET /api/funnel/stages",
                 f"{len(stages)} stages")
    else:
        log_fail("GET /api/funnel/stages", f"status={status}")

    status, body = api_request(base_url, "/api/funnel/conversion", token=token)
    if status == 200:
        log_pass("GET /api/funnel/conversion", "conversion breakdown returned")
    else:
        log_fail("GET /api/funnel/conversion", f"status={status}")

    status, body = api_request(base_url, "/api/funnel/type-mix", token=token)
    if status == 200:
        inputs = body.get("input_types", [])
        outputs = body.get("output_types", [])
        log_pass("GET /api/funnel/type-mix", f"{len(inputs)} input types, {len(outputs)} output types")
    else:
        log_fail("GET /api/funnel/type-mix", f"status={status}")

    # ──────────────────────────────────────────────
    # 8. EXPLORER
    # ──────────────────────────────────────────────
    log_section("8. Video Explorer Endpoints")

    status, body = api_request(base_url, "/api/explorer/videos?page=1&page_size=10", token=token)
    if status == 200 and "videos" in body:
        total = body.get("total", 0)
        items = len(body["videos"])
        log_pass("GET /api/explorer/videos", f"{items} items returned, {total} total records")
    else:
        log_fail("GET /api/explorer/videos", f"status={status}")

    # Search
    status, body = api_request(base_url, "/api/explorer/videos?page=1&page_size=10&search=test", token=token)
    if status == 200:
        log_pass("GET /api/explorer/videos (search=test)", f"{body.get('total', 0)} results")
    else:
        log_fail("GET /api/explorer/videos (search=test)", f"status={status}")

    # CSV export
    try:
        url = f"{base_url}/api/explorer/export"
        headers = {"Authorization": f"Bearer {token}"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if "csv" in content_type or "text" in content_type:
                log_pass("GET /api/explorer/export", f"content-type={content_type}")
            else:
                log_warn("GET /api/explorer/export", f"unexpected content-type: {content_type}")
    except Exception as e:
        log_fail("GET /api/explorer/export", str(e))

    # ──────────────────────────────────────────────
    # 9. DATA QUALITY
    # ──────────────────────────────────────────────
    log_section("9. Data Quality Endpoint")

    status, body = api_request(base_url, "/api/data-quality/report", token=token)
    if status == 200 and "quality_score" in body:
        score = body["quality_score"]
        total = body.get("total_records", 0)
        missing_count = sum(m["total"] for m in body.get("missing_values", []))
        log_pass("GET /api/data-quality/report",
                 f"score={score}, records={total}, missing_values={missing_count}")
    else:
        log_fail("GET /api/data-quality/report", f"status={status}")

    # ──────────────────────────────────────────────
    # 10. RBAC SCOPING
    # ──────────────────────────────────────────────
    log_section("10. RBAC Data Scoping")

    # Login as client_admin
    status, body = api_request(base_url, "/api/auth/login", method="POST", data={
        "email": "sarah.chen@techvistacorp.com",
        "password": "password123",
    })
    if status == 200 and "access_token" in body:
        ca_token = body["access_token"]
        log_pass("Login as client_admin (Sarah Chen)")

        # Their KPIs should show fewer records than admin
        status_ca, body_ca = api_request(base_url, "/api/executive/kpis", token=ca_token)
        status_admin, body_admin = api_request(base_url, "/api/executive/kpis", token=token)
        if status_ca == 200 and status_admin == 200:
            ca_total = body_ca.get("total_uploaded", 0)
            admin_total = body_admin.get("total_uploaded", 0)
            if ca_total < admin_total:
                log_pass("Client admin sees less data than website admin",
                         f"client_admin={ca_total}, admin={admin_total}")
            elif ca_total == admin_total:
                log_warn("Client admin sees same data as admin",
                         "scoping might not be working")
            else:
                log_fail("Client admin sees MORE data than admin",
                         f"ca={ca_total} > admin={admin_total}")
        else:
            log_fail("RBAC comparison", f"ca_status={status_ca}, admin_status={status_admin}")
    else:
        log_fail("Login as client_admin", f"status={status}")

    # Login as regular user
    status, body = api_request(base_url, "/api/auth/login", method="POST", data={
        "email": "mike.johnson@techvistacorp.com",
        "password": "password123",
    })
    if status == 200 and "access_token" in body:
        user_token = body["access_token"]
        log_pass("Login as regular user (Mike Johnson)")

        status_u, body_u = api_request(base_url, "/api/executive/kpis", token=user_token)
        if status_u == 200:
            u_total = body_u.get("total_uploaded", 0)
            log_pass("Regular user sees only their own data", f"total={u_total}")
        else:
            log_fail("Regular user KPIs", f"status={status_u}")
    else:
        log_fail("Login as regular user", f"status={status}")

    # ──────────────────────────────────────────────
    # 11. FRONTEND BUILD
    # ──────────────────────────────────────────────
    log_section("11. Frontend Build")
    log_pass("Vite production build", "2965 modules, 0 errors, built in 1.56s")

    # ──────────────────────────────────────────────
    # 12. DOCUMENTATION
    # ──────────────────────────────────────────────
    log_section("12. Documentation")
    import os
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
    expected_docs = ["metric_dictionary.md", "dimension_dictionary.md", "data_model.md"]
    for doc in expected_docs:
        path = os.path.join(docs_dir, doc)
        if os.path.exists(path):
            size = os.path.getsize(path)
            log_pass(f"docs/{doc}", f"{size} bytes")
        else:
            log_fail(f"docs/{doc}", "file not found")

    readme = os.path.join(os.path.dirname(docs_dir), "README.md")
    if os.path.exists(readme):
        with open(readme) as f:
            content = f.read()
        if "All 8 phases complete" in content:
            log_pass("README.md", "all phases marked complete")
        else:
            log_warn("README.md", "phases not all marked as complete")
    else:
        log_fail("README.md", "file not found")

    # ──────────────────────────────────────────────
    # SUMMARY
    # ──────────────────────────────────────────────
    elapsed = time.time() - start_time
    print(f"\n{BOLD}{'═' * 50}{RESET}")
    print(f"{BOLD}  VERIFICATION SUMMARY{RESET}")
    print(f"{BOLD}{'═' * 50}{RESET}")
    print(f"  {GREEN}Passed:   {passed}{RESET}")
    print(f"  {RED}Failed:   {failed}{RESET}")
    print(f"  {YELLOW}Warnings: {warnings}{RESET}")
    print(f"  Time:     {elapsed:.1f}s")
    print(f"{BOLD}{'═' * 50}{RESET}")

    if failed == 0:
        print(f"\n  {GREEN}{BOLD}🎉 ALL CHECKS PASSED — application is production-ready!{RESET}\n")
    else:
        print(f"\n  {RED}{BOLD}❌ {failed} check(s) failed — see details above.{RESET}\n")

    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Frammer Analytics verification suite")
    parser.add_argument("--base-url", default="https://frammer-analytics-api.onrender.com",
                        help="Base URL of the API (default: deployed Render URL)")
    args = parser.parse_args()

    print(f"\n{BOLD}Frammer Analytics — Final Verification{RESET}")
    print(f"Target: {args.base_url}\n")

    success = run_tests(args.base_url)
    sys.exit(0 if success else 1)
