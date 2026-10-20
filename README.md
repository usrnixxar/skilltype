# SkillType Admin

Standalone administration frontend for https://skilltype.vercel.app/.

Uses the existing Supabase project and player-session/admin-manager/spin-wheel services. No database copy or new admin account is needed. Student accounts cannot access administration operations. Credentials remain in page memory; reload requires login.

## Run

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (public client configuration only). Run npm ci, npm run dev, or npm run build. Never include a service-role key in this frontend.

## Deployment

Import this repository into Vercel as Vite with output dist. Set the same two public environment variables for Production and Preview. The root URL opens the admin login; Back to game links to SkillType.
