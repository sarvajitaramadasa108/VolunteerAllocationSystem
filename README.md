# Volunteer Allocation System

Volunteer allocation UI backed by Supabase.

## Setup

1. Create a Supabase project.
2. Apply the volunteer schema and seed data to Supabase.
3. Apply `supabase/bahuda_registration_schema.sql` for Bahuda Rathayatra registrations.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel or local env.
5. Run the Next.js app.

## Pages

- `/register` - volunteer registrations for Sri Jagannath Bahuda Rathayatra
- `/allocate` - search, register, and allocate service
- `/lookup` - event-day volunteer self-check page
- `/dashboard` - service-wise volunteer export
