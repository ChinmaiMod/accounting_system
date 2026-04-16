# IT Staffing Profitability System (Vercel + Supabase)

Phase 1 MVP for tracking W2/C2C profitability, timesheets, employee expenses, invoices, and payments.

## Stack

- React + Vite + TypeScript
- Supabase Auth (email/password)
- Supabase Postgres migrations
- Deploy target: Vercel

## Scope decisions

- Single owner account can manage **multiple businesses**
- No tenant membership/RLS complexity in this phase
- Multi-layer transaction routing is deferred to Phase 2

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Install and run:
   - `npm install`
   - `npm run dev`

## Database migrations

Apply SQL in order:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_profitability_views.sql`

## Current UI

- Email/password login and signup
- Authenticated dashboard
- Business switcher for owner-managed multiple businesses
- MVP module placeholders for staffing profitability workflows
