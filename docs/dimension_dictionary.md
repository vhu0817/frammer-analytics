# Dimension Dictionary

> This doc describes the five dimension tables that make up the "arms" of our star schema. If you're onboarding to the codebase or trying to understand what a filter dropdown actually maps to, start here.

Each dimension is a small lookup table that fact_videos references via a foreign key. When a user picks "TechVista Corp" from the Client dropdown on the dashboard, we're filtering `fact_videos.client_id` to match `dim_client.client_id = 1`.

---

## Clients (`dim_client`)

Every company that pays for Frammer is a "client." We currently have 8 of them, ranging from enterprise shops processing thousands of videos to small startups doing a few dozen a week.

| Column | Type | What it is |
|--------|------|------------|
| `client_id` | int (PK) | Auto-incremented ID |
| `client_name` | varchar(100) | Company name, must be unique |
| `client_segment` | varchar(50) | One of: `enterprise`, `mid-market`, `startup` |
| `region` | varchar(50) | Where they're based geographically |

The segment and region fields are mostly used for grouping in the Analysis page — you can pivot by client and see which segments produce the most content.

**Current clients:**

| Name | Segment | Region |
|------|---------|--------|
| TechVista Corp | enterprise | North America |
| MediaFlow Global | enterprise | Europe |
| ContentScale Inc | mid-market | North America |
| CloudCut Digital | mid-market | Asia Pacific |
| PixelWave Media | startup | North America |
| BrightReel Studios | mid-market | Europe |
| IndiCreate | startup | Asia Pacific |
| ReelForge | startup | Latin America |

A client can have multiple channels and multiple users — it's the top of the hierarchy.

---

## Channels (`dim_channel`)

A channel is basically a content stream within a client. Think of it like a YouTube channel — "BrightReel BTS," "CloudCut EN," "TechVista Corp Tutorials." Each client has 3-4 channels on average.

| Column | Type | What it is |
|--------|------|------------|
| `channel_id` | int (PK) | Auto-incremented ID |
| `client_id` | int (FK → dim_client) | Which client owns this channel |
| `channel_name` | varchar(150) | Display name |
| `workspace` | varchar(100) | The team/department (e.g., "Marketing," "Product") |
| `language` | varchar(50) | Primary language: English, Spanish, French, German, Japanese, Portuguese, Hindi |

One important frontend behavior: when you select a client in the global filter bar, the channel dropdown automatically scopes to only show that client's channels. This happens client-side by filtering the channel list where `channel.client_id === selectedClientId`.

---

## Users (`dim_user`)

These are the people who actually log in and upload videos. They're also the entities that our RBAC system controls access for.

| Column | Type | What it is |
|--------|------|------------|
| `user_id` | int (PK) | Auto-incremented ID |
| `client_id` | int (FK → dim_client) | Which client they belong to |
| `username` | varchar(100) | Display name (e.g., "Sarah Chen") |
| `email` | varchar(150) | Login email, unique across the system |
| `team_name` | varchar(100) | Their team within the client org |
| `role` | varchar(30) | Access level (see below) |
| `password_hash` | varchar(255) | bcrypt hash, never returned by the API |

**Roles and what they can see:**

| Role | Data Scope | Use Case |
|------|-----------|----------|
| `website_admin` | Everything, all clients | Us (the platform operators) |
| `client_admin` | Only their own client's data | Client-side managers |
| `user` | Only videos they personally uploaded | Individual content creators |

This scoping happens in `query_builder.py` — every dashboard query starts with `scoped_query(db, user)` which automatically applies the right `WHERE` clause based on the logged-in user's role.

---

## Content Types (`dim_type`)

This is the most "Frammer-specific" dimension. Every video has an input type (what format it came in as) and an output type (what Frammer transformed it into).

| Column | Type | What it is |
|--------|------|------------|
| `type_id` | int (PK) | Auto-incremented ID |
| `input_type` | varchar(80) | Source format: Webinar, Podcast, Interview, Presentation, Meeting Recording, Tutorial, Lecture, Panel Discussion, Product Demo |
| `output_type` | varchar(80) | Generated format: Short Clip, Highlights Reel, Chapter, Summary, Quote Card, Tutorial, Trailer |

Not every input-output combination exists — the simulator creates ~31 realistic pairings. For example, you'll see "Podcast → Short Clip" but not "Meeting Recording → Trailer."

The Publishing Funnel page has two charts that break down videos by input type (donut) and output type (horizontal bar), so this dimension is heavily used there.

---

## Platforms (`dim_platform`)

Where published videos end up. This is the simplest dimension — just 5 rows.

| Column | Type | What it is |
|--------|------|------------|
| `platform_id` | int (PK) | Auto-incremented ID |
| `platform_name` | varchar(80) | Platform name, unique |

**Platforms:** YouTube, Instagram, TikTok, LinkedIn, Twitter/X

The `platform_id` in fact_videos is **nullable** — if a video hasn't been published yet, this is NULL. That's why you can have videos where `is_published = false` and `platform_id = NULL`.

---

## How They All Connect

```
dim_client ──┐
dim_channel ─┤
dim_user ────┼──▶ fact_videos (14K+ records)
dim_type ────┤
dim_platform ┘
```

Every row in `fact_videos` has a foreign key to each dimension (except `platform_id` which is nullable). The star schema means you can slice the data by any combination of dimensions — the global filter bar on the frontend does exactly this by passing `client_id`, `channel_id`, and `platform_id` as query params to every API endpoint.
