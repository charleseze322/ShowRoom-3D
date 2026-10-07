# Setup and verification (Phases 1 and 6)

Use Node 20.9+ and npm. All frontend/backend code belongs to this Next.js app.
Never copy the prototype's server, catalog, node_modules or environment files.

## Local
```powershell
npm ci
npm run test:db
npm run typecheck
npm run lint
npm run build
npm run dev
curl.exe -i http://localhost:3000
```
Database tests run the real migration in embedded PostgreSQL (PGlite), with minimal
Supabase-managed auth/storage schema fixtures. They check A/B ownership, anonymous
published-only reads, immutable IDs, timestamps and storage folder policies.
They do not exercise hosted Auth, Storage uploads/MIME enforcement, or CORS.

## Supabase free project
1. Copy .env.example to .env.local, fill values from your project settings.
   Client URL/key must match server URL/anon key; BASE_URL is the deployed frontend
   origin (http://localhost:3000 locally). Service-role key stays server-only.
2. Paste supabase/migrations/001_init.sql into the SQL editor of a fresh project,
   then run it once. Do not edit the applied migration later.
3. Confirm RLS on artisans/products, four public buckets and their size/type limits.
4. In Authentication > Providers > Email, disable Confirm email for the demo.
   Set Auth Site URL and redirect allowlist to localhost and the Vercel frontend.
5. At signup use options.data.business_name; onboarding PUT /api/profile will
   create artisans using metadata business_name as the default and required WhatsApp.
   No incomplete artisan is inserted automatically at signup. API implementation is Phase 2.
6. Check environment and live table/bucket reads:
```powershell
npm run check:env
npm run verify:supabase
```
These commands print missing variable names/status only; never keys.
The live verifier is read-only; hosted two-user API ownership checks follow in Phase 3.

## Storage CORS
Hosted Supabase Storage supplies CORS headers; this is not configured by SQL RLS.
After uploading a test GLB/texture in Phase 5, use the real project/file URL:
```powershell
curl.exe -I -H "Origin: http://localhost:3000" "https://<project>.supabase.co/storage/v1/object/public/models/<user-id>/<file>.glb"
curl.exe -i -X OPTIONS -H "Origin: https://<your-app>.vercel.app" -H "Access-Control-Request-Method: GET" "https://<project>.supabase.co/storage/v1/object/public/models/<user-id>/<file>.glb"
```
Confirm Access-Control-Allow-Origin permits the frontend and a browser canvas can
load GLB/textures. Known public asset URLs remain readable for draft products.
Endpoint errors/private responses and protected-page middleware come in later phases.
Protected pages: /dashboard and /builder/*; public: /p/* and /api/p/*.

## Vercel
Import this repository, use Next.js defaults, and set the six env variables for the
same Supabase project. No separate backend app or serverless root api folder.
Live project/deployment verification stays pending until credentials and hosting exist.
Seed-photo placeholders are authorized and will be centralized for easy replacement.

## Dependency audit at handoff
npm audit --omit=dev reports zero runtime vulnerabilities.
The full npm audit reports five linked high-severity findings in the scaffold's
ESLint fast-glob/micromatch/braces chain (GHSA-vfj7-8cjw-p6xm). No patched braces
release is available from the registry at this check. The suggested forced fix
downgrades eslint-config-next to 14.x; it was not applied to the Next.js 16 scaffold.
This tooling issue is tracked here separately from runtime dependencies.
