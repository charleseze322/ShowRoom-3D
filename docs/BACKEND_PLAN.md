# ShowRoom 3D backend plan — approved

## Audit and architecture
PRD supersedes old backend notes. Prototype: `server.js`, `data/`, `utils/`, `tests/`, `package.json`; two tests/local HTTP checks passed, but required backend features are missing and client prices/invalid phones accepted. Frontend: Next.js App Router/TypeScript/Tailwind, being built; Figma Make is design reference. Migrate reusable WhatsApp logic/tests to TypeScript `/lib`; drop prototype server/catalog/routes.

1. One repo, one Next.js app, one free Vercel deployment; handlers exclusively `/app/api`.
2. Supabase free tier: Postgres/Auth/Storage; `@supabase/ssr` cookie sessions, Zod validation, nanoid IDs.
3. API/frontend import shared `/lib`; integrate into teammate's app without UI edits.

## Planned folders and environment
`app/api/.../route.ts` (routes below); shared `lib/{types,schemas,whatsapp,pricing,config,dimensions}.ts`; `lib/api/index.ts`; `lib/supabase/{client,server,middleware,admin}.ts`; `lib/server/{auth,mappers,products,uploads,http}.ts`; middleware entrypoint; `supabase/migrations/001_init.sql`; `scripts/{seed,verify}.ts`; `tests/`; `.env.example`; `API.md`.

Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service key server-only. Client uses relative `/api`; allow deployed origin/localhost:3000, check write Origin. Deployment notes: Auth Site URL/redirects, disable Confirm email, Storage CORS.

Sessions: [@supabase/ssr](https://supabase.com/docs/guides/auth/server-side/creating-a-client) browser/server clients, per-request cookie getAll/setAll. Middleware refreshes cookies/guards /dashboard and /builder/*; handlers independently verify `getUser()` or return 401. Entrypoint `middleware.ts`/`proxy.ts` follows installed Next.js version. Public `/p/*`, `/api/p/*` open; private responses uncached.

## Schema, RLS, and storage
Migration uses the requested schema (`?` nullable; timestamps default `now()`):

| Table | Columns |
| --- | --- |
| artisans | `id uuid PK -> auth.users(id) ON DELETE CASCADE`; `business_name text NOT NULL`, `whatsapp text NOT NULL`; `logo_url text?`, `location text?`, `created_at timestamptz` |
| products | `id uuid PK DEFAULT gen_random_uuid()`, `public_id text UNIQUE NOT NULL`, `artisan_id uuid NOT NULL -> artisans(id) ON DELETE CASCADE`; `name text NOT NULL`, `description/category/sku text?`; `photo_urls text[] DEFAULT '{}'`, `model_url text?`; `parts/finishes jsonb NOT NULL DEFAULT '[]'`; `base_price integer NOT NULL CHECK > 0`, `currency text NOT NULL DEFAULT 'NGN'`; `dimensions text?`; `status text NOT NULL DEFAULT 'draft' CHECK draft/published`; `view_count integer DEFAULT 0`, `created_at/updated_at timestamptz` |

Index artisan_id; UNIQUE indexes public_id. Trigger updated_at/immutable IDs; global SKU sequence `SR-001`; `nanoid(10)` collision retry. Signup stores business_name in user metadata; PUT /profile creates artisans using that as the businessName default, plus required WhatsApp.

RLS: artisans owner SELECT/INSERT/UPDATE (`auth.uid() = id`); products owner ALL USING/WITH CHECK (`auth.uid() = artisan_id`), public SELECT published. Session-scoped private handlers also filter owner; service client only for public artisan projection/atomic view RPC/seed. Keep immutable IDs; publish completeness is API-only (approved simplification).

Buckets `product-photos/models/textures/logos`: public read; owner-folder writes (`<auth.uid()>/...`), USING/WITH CHECK, MIME/size limits. Verify GLB/texture GET/OPTIONS CORS. Draft assets remain public at known URLs.

## API contract and validation
Routes prefixed `/api`; cookie session except public GET. Errors `{error:{code,message}}`, optional `error.missingItems:string[]`. Status: 400 validation, 401 auth, 404 absent/nonowner, 409 collisions, 413 size, 415 type, 429 rate, 500 unexpected.

Shared types: exact supplied `Product/Part/Finish/Artisan` contract; public excludes IDs/email/owner. `OwnerProduct = Product + {id,description,category,status,viewCount,createdAt,updatedAt}`. One snake_case mapper. Editable: name, description, category, photoUrls, modelUrl, parts, finishes, basePrice, currency, dimensions.

| Endpoint | Request -> successful response |
| --- | --- |
| GET /profile | none -> 200 `{businessName,whatsapp,logoUrl,location}`; 404 before onboarding |
| PUT /profile | required `{whatsapp}`, optional `{businessName,logoUrl,location}`; name defaults from signup metadata -> 200 profile (upsert session ID) |
| POST /products | `{name,basePrice,category,...Editable}` -> 201 OwnerProduct (draft) |
| GET /products | none -> 200 `{products:[{id,publicId,name,basePrice,currency,status,photoUrl,updatedAt}]}` |
| GET /products/:id | UUID -> 200 OwnerProduct |
| PUT /products/:id | partial Editable -> 200 OwnerProduct; merge then validate |
| DELETE /products/:id | UUID -> 200 `{deleted:true}`; owned asset cleanup, retryable failures |
| POST /products/:id/publish | none -> 200 `{status:"published",url}` or 400 missingItems |
| POST /products/:id/unpublish | none -> 200 `{status:"draft"}` |
| GET /p/:publicId | optional `?f=...` handled by shared utilities -> 200 Product; drafts/unknown same 404 |
| POST /upload | multipart `{bucket,file}` -> 201 `{url}` |

Shared Zod: reject noneditable fields; name 3–60, description <=500, category Table/Chair/Shelf/Bed/Other, positive integer basePrice, default NGN; max 3 photos/40 parts/20 finishes. Box [x,y,z], cylinder [radius,height], sphere [radius]; positive finite sizes, finite [x,y,z] positions, primary/secondary/accent slots, unique IDs, hex color, nullable textureUrl, integer modifier >=0. Phones: sanitize, 10–15 digits including country code. Owned asset URLs only. Bounding-box dimensions cm X/Z/Y; explicit override wins.

Publish: name/price/category, >=1 photo, model OR parts, one default per used slot, artisan WhatsApp. GLB-only uses primary slot. Revalidate published updates. Share URL = BASE_URL + `/p/` + immutable publicId; store ID only. Views best-effort. Delete skips logos/shared assets.

Upload single-file multipart; server validates size/extension/MIME/signature; `<user_id>/<random>.<ext>`. JPG/PNG/WebP photos <=3 MiB, GLB <=2 MiB, textures/logos <=1 MiB: below [Vercel's 4.5 MB limit](https://vercel.com/docs/functions/limitations), including bounded multipart overhead. Errors show measured/allowed size.

Exports: encodeConfig -> `?f=f2,f4`; decodeConfig ignores unknown IDs/defaults missing slots; calculatePrice alone sums basePrice + one modifier/slot. generateWhatsAppOrderLink: sanitized phone, currency, exact PRD §8.4 message/configured link; no client/URL price.

## Phases and done checklist
- [x] Audit/plan approved. Order: 1 -> 6 -> 2 -> 3 -> 4 -> 5 -> 7; stop after 1 and 6.
- [x] 1 Setup/migration/RLS/storage: 7 local PostgreSQL tests, typecheck/lint/build passed.
- [ ] Live Supabase SQL application and Storage CORS verification (credentials required).
- [ ] 6 Shared utilities/schemas/types + lib/mock-product.json: phone/price/config/default/message tests.
- [ ] 2 SSR auth/profile: signup/onboard, cookie refresh, invalid session/phone tests.
- [ ] 3 CRUD/dimensions: autosave, A-cannot-read/edit/delete-B tests; no ID/SKU concurrency tests.
- [ ] 4 Publish/public: missing-items, projection, draft/unknown 404, unpublish/views.
- [ ] 5 Upload/delete: limits/types/spoofs, ownership/CORS/cleanup.
- [ ] 7 Handoff: best-effort instance-local rate limits (30-minute cap), API.md examples, types/client, npm run seed (demo artisan/table/chair/shelf; centralized replaceable placeholder photos), deployment notes.
- [ ] Done: deployed signup -> onboarding -> draft -> upload -> parts/finishes -> publish -> anonymous link -> price/config -> prefilled WhatsApp; draft/nonowner blocked on artisan APIs, B's published page intentionally public.

Phase gate: test, tick verified work, report three lines/exact commands. Planned: `npm run dev`, `npm test`, `npm run typecheck`, `npm run verify` (two-user cookie-session API/RLS script), final `npm run build`/deployed phone checks. Teammate wires UI; integration needs app/Supabase/Vercel access. Simplify >30-minute work/document limitations. Only Phases 1 and 6 authorized now; no paid/out-of-scope features.
