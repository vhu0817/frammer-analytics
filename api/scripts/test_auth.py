"""
tests the auth flow end-to-end: login all 3 test users, call /me, verify roles.
run inside the api container: python -m scripts.test_auth
"""

import sys
import os
import requests

# the api is at localhost:8000 inside the container
BASE = "http://localhost:8000/api/auth"

TEST_USERS = [
    ("admin@frammer.com",  "test1234", "website_admin"),
    ("client@frammer.com", "test1234", "client_admin"),
    ("editor@frammer.com", "test1234", "user"),
]


def test_login_and_me():
    all_passed = True

    for email, password, expected_role in TEST_USERS:
        print(f"\n--- testing {email} ---")

        # login
        resp = requests.post(f"{BASE}/login", json={"email": email, "password": password})
        if resp.status_code != 200:
            print(f"  ✗ login failed: {resp.status_code} {resp.text}")
            all_passed = False
            continue

        data = resp.json()
        token = data["access_token"]
        user = data["user"]
        print(f"  ✓ login ok → token starts with {token[:20]}...")
        print(f"    user_id={user['user_id']}, role={user['role']}, client_id={user['client_id']}")

        # verify role matches what we expect
        if user["role"] != expected_role:
            print(f"  ✗ wrong role: expected {expected_role}, got {user['role']}")
            all_passed = False
            continue
        print(f"  ✓ role matches: {expected_role}")

        # call /me with the token
        me_resp = requests.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"})
        if me_resp.status_code != 200:
            print(f"  ✗ /me failed: {me_resp.status_code} {me_resp.text}")
            all_passed = False
            continue

        me_data = me_resp.json()
        print(f"  ✓ /me ok → {me_data['email']} ({me_data['role']})")

    # test bad credentials
    print("\n--- testing bad password ---")
    bad_resp = requests.post(f"{BASE}/login", json={"email": "admin@frammer.com", "password": "wrongpassword"})
    if bad_resp.status_code == 401:
        print(f"  ✓ correctly rejected: {bad_resp.json()['detail']}")
    else:
        print(f"  ✗ should have been 401, got {bad_resp.status_code}")
        all_passed = False

    # test bad token on /me
    print("\n--- testing invalid token ---")
    bad_me = requests.get(f"{BASE}/me", headers={"Authorization": "Bearer fake.token.here"})
    if bad_me.status_code == 401:
        print(f"  ✓ correctly rejected: {bad_me.json()['detail']}")
    else:
        print(f"  ✗ should have been 401, got {bad_me.status_code}")
        all_passed = False

    # test missing header on /me
    print("\n--- testing no auth header ---")
    no_auth = requests.get(f"{BASE}/me")
    if no_auth.status_code == 401:
        print(f"  ✓ correctly rejected: {no_auth.json()['detail']}")
    else:
        print(f"  ✗ should have been 401, got {no_auth.status_code}")
        all_passed = False

    print("\n" + ("=" * 40))
    if all_passed:
        print("🎉 all auth tests passed!")
    else:
        print("❌ some tests failed — check output above")


if __name__ == "__main__":
    print("running auth flow tests...")
    test_auth = test_login_and_me()
