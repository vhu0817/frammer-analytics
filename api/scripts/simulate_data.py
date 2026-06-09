"""
seeds the database with realistic dimension data + fact records.
run inside the api container: python -m scripts.simulate_data
"""

import sys
import os
import random
import math
from datetime import datetime, timedelta

import bcrypt

# make sure `app` package is importable when running from /app/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.dim_client import DimClient
from app.models.dim_channel import DimChannel
from app.models.dim_user import DimUser
from app.models.dim_type import DimType
from app.models.dim_platform import DimPlatform
from app.models.fact_videos import FactVideos

random.seed(42)  # reproducible runs


# ────────────────────────────────────────────
# dimension data — all hand-picked to feel real
# ────────────────────────────────────────────

CLIENTS = [
    # (name, segment, region) — 3 enterprise, 3 mid-market, 2 startup
    ("TechVista Corp",     "enterprise",  "North America"),
    ("MediaFlow Global",   "enterprise",  "Europe"),
    ("ContentScale Inc",   "enterprise",  "Asia Pacific"),
    ("BrightReel Studios", "mid-market",  "North America"),
    ("PixelWave Media",    "mid-market",  "Europe"),
    ("CloudCut Digital",   "mid-market",  "Latin America"),
    ("IndiCreate",         "startup",     "Asia Pacific"),
    ("ReelForge",          "startup",     "North America"),
]

# channels per client — enterprise gets more, startups get fewer
# (channel_name, workspace, language)
CHANNELS_BY_CLIENT = {
    "TechVista Corp": [
        ("TechVista Main",         "Engineering",  "English"),
        ("TechVista Tutorials",    "Engineering",  "English"),
        ("TechVista LATAM",        "Marketing",    "Spanish"),
        ("TechVista DE",           "Marketing",    "German"),
        ("TechVista Product Demo", "Product",      "English"),
    ],
    "MediaFlow Global": [
        ("MediaFlow News",       "Editorial",    "English"),
        ("MediaFlow FR",         "Editorial",    "French"),
        ("MediaFlow Webinars",   "Marketing",    "English"),
        ("MediaFlow Shorts Hub", "Content",      "English"),
    ],
    "ContentScale Inc": [
        ("ContentScale Asia",    "Regional",     "Hindi"),
        ("ContentScale JP",      "Regional",     "Japanese"),
        ("ContentScale EN",      "Global",       "English"),
        ("ContentScale Podcast", "Content",      "English"),
        ("ContentScale Academy", "Training",     "English"),
    ],
    "BrightReel Studios": [
        ("BrightReel Originals", "Production",   "English"),
        ("BrightReel BTS",       "Production",   "English"),
        ("BrightReel ES",        "Localization", "Spanish"),
    ],
    "PixelWave Media": [
        ("PixelWave Creative",   "Design",       "English"),
        ("PixelWave Trends",     "Social",       "English"),
        ("PixelWave DE",         "Social",       "German"),
        ("PixelWave Vlogs",      "Content",      "English"),
    ],
    "CloudCut Digital": [
        ("CloudCut Highlights",  "Marketing",    "Portuguese"),
        ("CloudCut EN",          "Marketing",    "English"),
        ("CloudCut Tutorials",   "Support",      "Spanish"),
    ],
    "IndiCreate": [
        ("IndiCreate Studio",    "Production",   "English"),
        ("IndiCreate Hindi",     "Production",   "Hindi"),
    ],
    "ReelForge": [
        ("ReelForge Clips",      "Content",      "English"),
        ("ReelForge Interviews", "Content",      "English"),
    ],
}
# total: 5+4+5+3+4+3+2+2 = 28 channels

# users per client — enterprise ~10, mid-market ~5-6, startup ~3
# (username, email_prefix, team_name, role)
# role: website_admin (1 total), client_admin (1 per client), rest are "user"
USERS_BY_CLIENT = {
    "TechVista Corp": [
        ("admin",          "admin",            "Platform",     "website_admin"),
        ("sarah_chen",     "sarah.chen",       "Engineering",  "client_admin"),
        ("mike_johnson",   "mike.johnson",     "Engineering",  "user"),
        ("priya_sharma",   "priya.sharma",     "Marketing",    "user"),
        ("james_wilson",   "james.wilson",     "Marketing",    "user"),
        ("emma_davis",     "emma.davis",        "Product",      "user"),
        ("alex_kumar",     "alex.kumar",        "Engineering",  "user"),
        ("lisa_martinez",  "lisa.martinez",     "Marketing",    "user"),
        ("david_lee",      "david.lee",         "Product",      "user"),
        ("rachel_brown",   "rachel.brown",      "Engineering",  "user"),
    ],
    "MediaFlow Global": [
        ("jean_dupont",    "jean.dupont",       "Editorial",    "client_admin"),
        ("anna_muller",    "anna.muller",       "Editorial",    "user"),
        ("tom_baker",      "tom.baker",         "Marketing",    "user"),
        ("sophie_blanc",   "sophie.blanc",      "Content",      "user"),
        ("marcus_reed",    "marcus.reed",       "Marketing",    "user"),
        ("claire_dubois",  "claire.dubois",     "Editorial",    "user"),
    ],
    "ContentScale Inc": [
        ("raj_patel",      "raj.patel",         "Global",       "client_admin"),
        ("yuki_tanaka",    "yuki.tanaka",       "Regional",     "user"),
        ("amit_verma",     "amit.verma",        "Regional",     "user"),
        ("nina_wang",      "nina.wang",         "Content",      "user"),
        ("sam_gupta",      "sam.gupta",         "Training",     "user"),
        ("kenji_sato",     "kenji.sato",        "Regional",     "user"),
        ("anita_desai",    "anita.desai",       "Global",       "user"),
    ],
    "BrightReel Studios": [
        ("carlos_ruiz",    "carlos.ruiz",       "Production",   "client_admin"),
        ("maya_foster",    "maya.foster",        "Production",   "user"),
        ("diego_silva",    "diego.silva",        "Localization", "user"),
        ("beth_adams",     "beth.adams",         "Production",   "user"),
        ("leo_garcia",     "leo.garcia",         "Production",   "user"),
    ],
    "PixelWave Media": [
        ("hans_schmidt",   "hans.schmidt",      "Design",       "client_admin"),
        ("nina_vogel",     "nina.vogel",         "Social",       "user"),
        ("max_braun",      "max.braun",          "Social",       "user"),
        ("julia_kern",     "julia.kern",         "Content",      "user"),
        ("felix_meyer",    "felix.meyer",        "Design",       "user"),
        ("lena_hoffman",   "lena.hoffman",       "Social",       "user"),
    ],
    "CloudCut Digital": [
        ("pedro_santos",   "pedro.santos",      "Marketing",    "client_admin"),
        ("lucia_costa",    "lucia.costa",        "Marketing",    "user"),
        ("roberto_lima",   "roberto.lima",       "Support",      "user"),
        ("maria_oliveira", "maria.oliveira",     "Marketing",    "user"),
    ],
    "IndiCreate": [
        ("arjun_nair",     "arjun.nair",        "Production",   "client_admin"),
        ("sneha_iyer",     "sneha.iyer",         "Production",   "user"),
        ("vikram_rao",     "vikram.rao",          "Production",   "user"),
    ],
    "ReelForge": [
        ("jordan_cole",    "jordan.cole",        "Content",      "client_admin"),
        ("taylor_reed",    "taylor.reed",        "Content",      "user"),
        ("casey_brooks",   "casey.brooks",       "Content",      "user"),
    ],
}
# total: 10+6+7+5+6+4+3+3 = 44 users

# not every input type makes sense with every output type
# (input_type, output_type) combos
TYPES = [
    ("Webinar",         "Short Clip"),
    ("Webinar",         "Summary"),
    ("Webinar",         "Highlights Reel"),
    ("Webinar",         "Chapter"),
    ("Podcast",         "Short Clip"),
    ("Podcast",         "Audiogram"),
    ("Podcast",         "Summary"),
    ("Podcast",         "Chapter"),
    ("Interview",       "Short Clip"),
    ("Interview",       "Quote Card"),
    ("Interview",       "Highlights Reel"),
    ("Product Demo",    "Short Clip"),
    ("Product Demo",    "Tutorial"),
    ("Product Demo",    "Feature Spotlight"),
    ("Tutorial",        "Short Clip"),
    ("Tutorial",        "Step-by-Step"),
    ("Tutorial",        "Chapter"),
    ("Conference Talk", "Short Clip"),
    ("Conference Talk", "Summary"),
    ("Conference Talk", "Highlights Reel"),
    ("Conference Talk", "Chapter"),
    ("Live Stream",     "Short Clip"),
    ("Live Stream",     "Highlights Reel"),
    ("Live Stream",     "Best Moments"),
    ("Training Video",  "Short Clip"),
    ("Training Video",  "Chapter"),
    ("Training Video",  "Summary"),
    ("Customer Story",  "Short Clip"),
    ("Customer Story",  "Testimonial"),
    ("Vlog",            "Short Clip"),
    ("Vlog",            "Reel"),
]
# total: 31 types

PLATFORMS = [
    "YouTube",
    "Instagram",
    "LinkedIn",
    "TikTok",
    "X (Twitter)",
]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def seed_dimensions(db):
    """insert all dimension rows, return lookup dicts for fact generation."""

    # --- clients ---
    client_map = {}  # name -> client_id
    for name, segment, region in CLIENTS:
        c = DimClient(client_name=name, client_segment=segment, region=region)
        db.add(c)
        db.flush()  # need the auto-generated id
        client_map[name] = c.client_id
        print(f"  client: {name} (id={c.client_id})")

    # --- channels ---
    channel_rows = []  # list of (channel_id, client_id) for fact gen
    for client_name, channels in CHANNELS_BY_CLIENT.items():
        cid = client_map[client_name]
        for ch_name, workspace, lang in channels:
            ch = DimChannel(
                client_id=cid,
                channel_name=ch_name,
                workspace=workspace,
                language=lang,
            )
            db.add(ch)
            db.flush()
            channel_rows.append((ch.channel_id, cid))
            print(f"  channel: {ch_name} → client_id={cid}")

    # --- users ---
    # everyone gets "password123" — this is seed data, not production
    default_hash = hash_password("password123")
    user_rows = []  # list of (user_id, client_id) for fact gen
    for client_name, users in USERS_BY_CLIENT.items():
        cid = client_map[client_name]
        domain = client_name.lower().replace(" ", "") + ".com"
        for username, email_prefix, team, role in users:
            u = DimUser(
                client_id=cid,
                username=username,
                email=f"{email_prefix}@{domain}",
                team_name=team,
                role=role,
                password_hash=default_hash,
            )
            db.add(u)
            db.flush()
            user_rows.append((u.user_id, cid))
            print(f"  user: {u.email} ({role})")

    # --- types ---
    type_ids = []
    for input_t, output_t in TYPES:
        t = DimType(input_type=input_t, output_type=output_t)
        db.add(t)
        db.flush()
        type_ids.append(t.type_id)

    print(f"  types: {len(type_ids)} combinations")

    # --- platforms ---
    platform_ids = []
    for pname in PLATFORMS:
        p = DimPlatform(platform_name=pname)
        db.add(p)
        db.flush()
        platform_ids.append(p.platform_id)

    print(f"  platforms: {len(platform_ids)}")

    db.commit()
    print(f"\n✓ dimensions seeded: {len(CLIENTS)} clients, {len(channel_rows)} channels, "
          f"{len(user_rows)} users, {len(type_ids)} types, {len(platform_ids)} platforms")

    return {
        "client_map": client_map,
        "channel_rows": channel_rows,
        "user_rows": user_rows,
        "type_ids": type_ids,
        "platform_ids": platform_ids,
    }


# ────────────────────────────────────────────
# fact data — 15k videos over 180 days
# ────────────────────────────────────────────

# enterprise clients produce way more content than startups
VOLUME_MULTIPLIER = {
    "enterprise": 4.0,
    "mid-market": 2.0,
    "startup":    1.0,
}

# titles for generated videos — randomly combined
TITLE_PREFIXES = [
    "How to", "Getting Started with", "Deep Dive into", "Introduction to",
    "Advanced", "Q&A:", "Behind the Scenes:", "Weekly Update:",
    "Best Practices for", "The Future of", "Understanding", "Mastering",
    "Panel Discussion:", "Live Demo:", "Case Study:",
]

TITLE_TOPICS = [
    "AI-Powered Editing", "Content Strategy", "Video Marketing",
    "Social Media Growth", "Brand Building", "Team Collaboration",
    "Analytics Dashboard", "Workflow Automation", "Creative Tools",
    "Audience Engagement", "Platform Optimization", "Data-Driven Content",
    "Remote Production", "Monetization", "SEO for Video",
    "Shorts Strategy", "Podcast Repurposing", "Enterprise Workflows",
    "Content Localization", "Performance Metrics",
]


def generate_title():
    """random but plausible video title."""
    return f"{random.choice(TITLE_PREFIXES)} {random.choice(TITLE_TOPICS)}"


def seed_facts(db, dims):
    """generate ~15k fact_videos with realistic patterns."""

    channel_rows = dims["channel_rows"]    # [(channel_id, client_id), ...]
    user_rows = dims["user_rows"]          # [(user_id, client_id), ...]
    type_ids = dims["type_ids"]
    platform_ids = dims["platform_ids"]

    # build lookup: client_id -> segment (for volume scaling)
    client_segments = {}
    for name, segment, _ in CLIENTS:
        client_segments[dims["client_map"][name]] = segment

    # build lookup: client_id -> list of channels and users belonging to them
    channels_by_client = {}
    for ch_id, cl_id in channel_rows:
        channels_by_client.setdefault(cl_id, []).append(ch_id)

    users_by_client = {}
    for u_id, cl_id in user_rows:
        users_by_client.setdefault(cl_id, []).append(u_id)

    # 180 days ending yesterday
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=180)

    # base daily rate across all clients — we'll scale per client segment
    # aiming for ~15k total: 15000 / 180 ≈ 83 videos/day base
    BASE_DAILY = 83

    # figure out total weight so we can distribute daily uploads across clients
    client_ids = list(channels_by_client.keys())
    total_weight = sum(VOLUME_MULTIPLIER[client_segments[cid]] for cid in client_ids)

    total_created = 0
    batch = []
    batch_size = 500

    print(f"  generating facts from {start_date.date()} to {end_date.date()}...")

    for day_offset in range(180):
        current_date = start_date + timedelta(days=day_offset)
        weekday = current_date.weekday()  # 0=mon, 6=sun

        # weekday bias: ~70% of uploads happen mon-fri
        # weekdays get a 1.15x boost, weekends get 0.6x
        day_factor = 1.15 if weekday < 5 else 0.6

        # gentle growth trend: start at 0.85x, end at 1.15x
        # simulates a product gaining traction over 6 months
        growth = 0.85 + 0.30 * (day_offset / 179)

        # some random noise so it doesn't look too smooth (±15%)
        noise = random.uniform(0.85, 1.15)

        daily_total = int(BASE_DAILY * day_factor * growth * noise)

        for client_id in client_ids:
            segment = client_segments[client_id]
            weight = VOLUME_MULTIPLIER[segment]

            # this client's share of today's uploads
            client_daily = max(1, int(daily_total * weight / total_weight))

            client_channels = channels_by_client[client_id]
            client_users = users_by_client[client_id]

            for _ in range(client_daily):
                # random time during business-ish hours (6am - 10pm)
                hour = random.randint(6, 22)
                minute = random.randint(0, 59)
                second = random.randint(0, 59)
                uploaded_at = current_date.replace(hour=hour, minute=minute, second=second)

                # log-normal duration: median ~600s (10min), most between 2-45min
                # this is what real video durations look like — few short, long tail
                duration = random.lognormvariate(math.log(600), 0.7)
                duration = max(30.0, min(duration, 7200.0))  # clamp to 30s - 2hr

                # processing: 85% get processed, takes 1-48 hours
                is_processed = random.random() < 0.85
                processed_at = None
                if is_processed:
                    proc_delay = timedelta(hours=random.uniform(1, 48))
                    processed_at = uploaded_at + proc_delay

                # publishing: 65% of processed videos get published, takes 1-72 hours after processing
                is_published = False
                published_at = None
                platform_id = None
                if is_processed and random.random() < 0.65:
                    is_published = True
                    pub_delay = timedelta(hours=random.uniform(1, 72))
                    published_at = processed_at + pub_delay
                    platform_id = random.choice(platform_ids)

                # 5% bad data: missing title
                title = None if random.random() < 0.05 else generate_title()

                video = FactVideos(
                    client_id=client_id,
                    channel_id=random.choice(client_channels),
                    user_id=random.choice(client_users),
                    type_id=random.choice(type_ids),
                    platform_id=platform_id,
                    uploaded_at=uploaded_at,
                    processed_at=processed_at,
                    published_at=published_at,
                    duration_seconds=round(duration, 1),
                    is_processed=is_processed,
                    is_published=is_published,
                    title=title,
                )
                batch.append(video)

                if len(batch) >= batch_size:
                    db.add_all(batch)
                    db.flush()
                    total_created += len(batch)
                    batch = []

        # progress indicator every 30 days
        if (day_offset + 1) % 30 == 0:
            print(f"    ...day {day_offset + 1}/180 — {total_created + len(batch)} videos so far")

    # flush remaining
    if batch:
        db.add_all(batch)
        db.flush()
        total_created += len(batch)

    db.commit()
    print(f"\n✓ fact data seeded: {total_created} videos over 180 days")
    return total_created


if __name__ == "__main__":
    db = SessionLocal()
    try:
        # check if dimensions already exist
        existing_clients = db.query(DimClient).count()
        existing_facts = db.query(FactVideos).count()

        if existing_facts > 0:
            print(f"⚠ found {existing_facts} fact rows already — skipping.")
            print("  truncate fact_videos if you want to re-seed.")
            sys.exit(0)

        # seed dimensions if needed
        if existing_clients > 0:
            print(f"found {existing_clients} clients — reloading dimension IDs...\n")
            # rebuild the lookup dicts from existing DB rows
            client_map = {}
            for c in db.query(DimClient).all():
                client_map[c.client_name] = c.client_id

            channel_rows = [(ch.channel_id, ch.client_id) for ch in db.query(DimChannel).all()]
            user_rows = [(u.user_id, u.client_id) for u in db.query(DimUser).all()]
            type_ids = [t.type_id for t in db.query(DimType).all()]
            platform_ids = [p.platform_id for p in db.query(DimPlatform).all()]

            dims = {
                "client_map": client_map,
                "channel_rows": channel_rows,
                "user_rows": user_rows,
                "type_ids": type_ids,
                "platform_ids": platform_ids,
            }
        else:
            print("seeding dimension tables...\n")
            dims = seed_dimensions(db)

        print("\nseeding fact table...\n")
        seed_facts(db, dims)
        print("\n🎉 all done!")
    except Exception as e:
        db.rollback()
        print(f"✗ error: {e}")
        raise
    finally:
        db.close()
