# OSIANTECH

Node.js + Express + EJS academy platform.

## Stack

- Authentication: Firebase Auth (email/password + Google)
- Database: Supabase Postgres via direct connection string

## Environment Variables

Create a .env file based on .env.example and set:

- SUPABASE_DB_URL
- SUPABASE_PROFILE_TABLE (optional, defaults to user_profiles)
- SUPABASE_USERS_TABLE (optional, defaults to app_users)

Example:

SUPABASE_DB_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
SUPABASE_PROFILE_TABLE=user_profiles
SUPABASE_USERS_TABLE=app_users

## Where To Find The Connection String

In the newer Supabase UI, look in one of these places:

- Connect button in the project header
- Settings -> Database
- Database -> Connection string

You want the pooled Postgres connection string, usually on port 6543.

Copy the full Postgres URI and place it in SUPABASE_DB_URL.

## Supabase Tables

Run this SQL in Supabase SQL editor:

```sql
create table if not exists public.app_users (
	uid text primary key,
	email text not null,
	display_name text,
	auth_provider text,
	profile_completed boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
	uid text primary key,
	name text not null,
	age integer not null,
	nationality text not null,
	phone_number text not null,
	gender text,
	city text not null,
	education text not null,
	email text,
	completed_profile boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
```

## User Sync Flow

- On Firebase signup/signin (email or Google), the app calls backend route POST /api/profile/sync-user.
- The backend writes directly to Supabase Postgres and upserts a row in app_users.
- Profile form saves continue in user_profiles.
- When profile is completed, app_users.profile_completed is set to true.

The database connection string stays on the server only. Do not expose it to client-side code.

## Run

```bash
npm install
npm run dev
```
