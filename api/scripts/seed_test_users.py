"""
seeds 3 test users for auth testing.
run inside the api container: python -m scripts.seed_test_users
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.dim_user import DimUser
from app.services.auth_service import hash_password

TEST_USERS = [
    {
        "email": "admin@frammer.com",
        "username": "frammer_admin",
        "team_name": "Platform",
        "role": "website_admin",
        "client_id": 1,
    },
    {
        "email": "client@frammer.com",
        "username": "client_manager",
        "team_name": "Operations",
        "role": "client_admin",
        "client_id": 2,
    },
    {
        "email": "editor@frammer.com",
        "username": "video_editor",
        "team_name": "Content",
        "role": "user",
        "client_id": 2,
    },
]

# all test accounts use the same password for easy manual testing
TEST_PASSWORD = "test1234"


def seed():
    db = SessionLocal()
    try:
        hashed = hash_password(TEST_PASSWORD)

        for u in TEST_USERS:
            existing = db.query(DimUser).filter(DimUser.email == u["email"]).first()
            if existing:
                print(f"  skip: {u['email']} already exists (id={existing.user_id})")
                continue

            user = DimUser(password_hash=hashed, **u)
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"  created: {u['email']} → {u['role']} (id={user.user_id})")

        print("\n✓ test users ready")
        print(f"  password for all: {TEST_PASSWORD}")
    except Exception as e:
        db.rollback()
        print(f"✗ error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    print("seeding test users...\n")
    seed()
