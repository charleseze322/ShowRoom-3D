# ShowRoom 3D: Product Requirements Document (PRD)

**Team:** Vertex | **Track:** B (Creative Economy) | **Timeline:** 48 hours | **Version:** 1.0

---

## 1. Overview

### 1.1 Problem
Most independent furniture makers, interior designers, and spatial artisans sell through flat 2D photos on Instagram and WhatsApp. Photos can't convey scale, material, or fit, so buyers hesitate and high-ticket sales stall.

### 1.2 Solution
ShowRoom 3D is a lightweight web studio. Artisans build an interactive 3D version of their product (from simple shapes, or by uploading a `.glb`). Buyers open a shareable link, rotate the piece 360°, switch finishes, see dimensions and a live price, and order through WhatsApp. No app download, no 3D skills needed.

### 1.3 Target users
| User | Description | Main need |
|---|---|---|
| **Artisan (creator)** | Independent furniture maker, decorator, spatial creator. Often non-technical, phone-first. | Show work convincingly and get inquiries fast |
| **Buyer** | Prospective customer arriving from a WhatsApp or Instagram link, almost always on a phone. | Confidence in size, finish, and price before ordering |

### 1.4 Goals and non-goals
**Goals (48h):**
- An artisan can sign up, build a product in under 5 minutes, and publish a shareable link.
- A buyer can open the link and rotate, customize, see the price, and order on WhatsApp.
- The artisan receives the exact configuration the buyer chose.

**Non-goals (not in this build):** payments, delivery tracking, artisan storefront pages, multi-product bundles, AI photo-to-3D inside the app, AR, reviews, admin panel.

### 1.5 Success metrics (for the pitch)
- Time from sign-up to published link: under 5 minutes.
- Link loads and is interactive on a mid-range phone in under 4 seconds.
- Buyer reaches the WhatsApp button in under 30 seconds.

---

## 2. How the 3D works (core concept)

Nothing is converted from photos. A product is stored as a **list of parts** (boxes, cylinders, spheres). The browser draws them with React Three Fiber. Each part belongs to a **material slot** (e.g. `primary` = tabletop, `secondary` = legs). A finish applies to every part in its slot.

Two ways to get a 3D product:

| Path | Who it's for | How |
|---|---|---|
| **A. Shape Builder** (main) | Everyone | Pick a template, edit sizes, add or adjust parts |
| **B. Upload `.glb`** (bonus) | Artisans who already have a 3D file | Upload file (max 2MB); viewer loads it instead of shapes |
| **C. Photo-to-3D** (roadmap, pitch only) | Future | Pre-generated example shown in pitch; not built into the app |

The viewer rule is: `if (modelUrl) load the .glb, else render the parts`.

Be honest in the pitch: shape-built models are stylized approximations. The value is scale, finish confidence, and price clarity.

---

## 3. Authentication (artisan side only)

**Buyers never log in.** The buyer link is public.

**Artisan auth: Supabase Auth, email + password** (fastest to build; free).
- Optional extra if time allows: "Continue with Google".
- No email verification during the hackathon (turn it off in Supabase) so the demo isn't blocked by a missing email.

### Screens
| Screen | Fields | Notes |
|---|---|---|
| Sign up | Email, password, business name | Business name becomes the display name on buyer pages |
| Log in | Email, password | "Forgot password" can be skipped for MVP |
| Onboarding (right after sign up) | WhatsApp number (required), logo (optional), location (optional) | One screen, skippable except WhatsApp. Without a WhatsApp number the order button can't work |

### Rules
- Every dashboard and builder route requires a session; unauthenticated users redirect to log in.
- WhatsApp number is validated: digits only after sanitizing, 10–15 digits, with country code (e.g. `2348012345678`). Show a hint: "Include country code, no + or spaces".

---

## 4. Artisan profile

Kept minimal. Stored on the `artisans` table and shown on the buyer page header.

| Field | Required | Used for |
|---|---|---|
| Business name | Yes | Header on buyer page, WhatsApp message |
| WhatsApp number | Yes | Order button destination |
| Logo | No | Header on buyer page (falls back to initials circle) |
| Location | No | Small text under business name |
| Bio | No | Not shown in MVP (stretch: storefront) |

**Profile page** is a simple form with Save. Reachable from the avatar menu in the dashboard.

---

## 5. Artisan dashboard

### 5.1 Layout (mobile-first, works on desktop)
```
┌──────────────────────────────────────────┐
│  ShowRoom 3D            [Avatar ▾]       │
├──────────────────────────────────────────┤
│  Your Products                [+ New]    │
│                                          │
│  ┌────────────┐  ┌────────────┐          │
│  │ [thumb]    │  │ [thumb]    │          │
│  │ Dining     │  │ Lounge     │          │
│  │ Table      │  │ Chair      │          │
│  │ ₦150,000   │  │ ₦85,000    │          │
│  │ ● Published│  │ ○ Draft    │          │
│  │ [Copy link]│  │ [Edit]     │          │
│  │ [Edit] [⋯] │  │ [⋯]        │          │
│  └────────────┘  └────────────┘          │
└──────────────────────────────────────────┘
```

### 5.2 Elements
- **Header:** logo, avatar menu (Profile, Log out).
- **"+ New product" button:** always visible (floating on mobile).
- **Product card:** thumbnail (reference photo), name, base price, status badge (Draft or Published), actions.
- **Card actions:** Copy link (published only), Edit, Preview, and a menu with Unpublish and Delete (delete asks for confirmation).
- **Empty state:** friendly message, "Build your first 3D product in 5 minutes", and a button that jumps to template selection.
- **Stretch:** view count per product, and an inquiries counter (number of times the WhatsApp button was tapped).

### 5.3 UX notes
- "Copy link" gives instant feedback (toast: "Link copied. Paste it in WhatsApp or Instagram").
- A "Share on WhatsApp" button next to Copy link opens `wa.me/?text=<link>`.
- Loading state uses skeleton cards, not a blank screen.

---

## 6. Create / edit product (the builder)

The builder is a **4-step flow** with a progress bar. The 3D preview stays visible during step 2 and 3. Progress auto-saves as Draft so nothing is lost.

### Step 1: Basics
| Field | Type | Required | Validation |
|---|---|---|---|
| Product name | Text | Yes | 3–60 chars |
| Description | Textarea | No | Max 500 chars |
| Category | Select (Table, Chair, Shelf, Bed, Other) | Yes | Used to suggest a template |
| Reference photo(s) | Image upload (up to 3) | Yes (at least 1) | JPG/PNG/WebP, max 3MB each, compressed in browser before upload |
| Base price | Number | Yes | Greater than 0 |
| Currency | Select (default NGN ₦) | Yes | Stored per product |

### Step 2: Build the 3D model
Two tabs at the top: **Build with shapes** (default) and **Upload .glb**.

**Tab 1: Build with shapes**
```
┌─────────────────────────────────────────────┐
│ Template: [Table] [Chair] [Shelf] [Bed]     │
├────────────────────┬────────────────────────┤
│                    │  Parts                 │
│   LIVE 3D PREVIEW  │  1 Box  (Tabletop) ✎ ✕ │
│   (rotatable)      │  2 Cyl  (Leg)      ✎ ✕ │
│                    │  3 Cyl  (Leg)      ✎ ✕ │
│  [reference photo] │  [+ Box][+ Cyl][+ Sph] │
│   (small, toggle)  │                        │
└────────────────────┴────────────────────────┘
```
- Choosing a template loads pre-assembled parts. The artisan edits instead of starting from nothing.
- Selecting a part shows its editor: **size** (X/Y/Z or radius/height), **position** (X/Y/Z), **slot** (primary, secondary, accent), **label**.
- Use **number inputs and sliders**, not drag handles (faster to build, more reliable on phones).
- The selected part is highlighted in the preview.
- A **reference photo** panel sits beside the preview so the artisan can compare and match by eye.
- **Overall dimensions** (L × W × H) are **auto-calculated** from the parts' bounding box and shown live. The artisan can override the text if needed.
- Actions: duplicate part, delete part, reset to template.

**Tab 2: Upload .glb**
- Drag-and-drop or file picker, `.glb` only, **max 2MB** (validated in browser and on server).
- On success the file shows in the preview immediately.
- On failure: clear message, e.g. "File is 4.2MB. Please compress it under 2MB (free tool: gltf.report)".
- Uploading a model replaces the shapes for this product (confirm before switching).
- The artisan still defines **material slots** by mesh name for finishes to work (simple mapping UI: mesh name → slot). If skipped, finishes recolor the whole model.

### Step 3: Finishes and pricing
Finishes are grouped by slot. Buyers pick one finish per slot.

| Field | Type | Notes |
|---|---|---|
| Slot | Select | Only slots used by the parts are offered |
| Finish name | Text | e.g. "Dark Smoked Walnut" |
| Look | Color picker, or texture image upload | Texture max 1MB; color is the default and always works |
| Price modifier | Number | Added to base price when selected (0 for the default finish) |
| Default | Toggle | One default per slot |

- Minimum: one finish per slot (the default).
- Preview updates instantly when a finish is added or edited.
- A **price summary** shows base price and the range ("From ₦150,000 to ₦175,000").

### Step 4: Review and publish
- Full preview exactly as the buyer will see it, with a **device toggle** (phone / desktop).
- Checklist: name ✓, photo ✓, 3D model ✓, finishes ✓, WhatsApp number ✓. Missing items link back to the right step.
- Buttons: **Save as draft** and **Publish**.
- On publish: success screen with the **shareable link**, **Copy link**, **Share on WhatsApp**, and a **QR code** (stretch, nice for physical showrooms).

---

## 7. Shareable URL: generation, storage, and security

### 7.1 Format
```
https://showroom3d.app/p/k7Xm2pQa9R
```
- `/p/` is the public product route.
- `k7Xm2pQa9R` is a **random public ID** (10 characters, generated with `nanoid`). Not the database primary key, not a sequential number.

### 7.2 Is the URL saved in the database?
**Only the ID is saved, not the full URL.**
- `products.public_id` stores `k7Xm2pQa9R`.
- The full link is built when needed: `BASE_URL + "/p/" + public_id`. This way, changing the domain never breaks stored data.
- Generated once when the product is first created; **never changes** (so shared links keep working after edits).

### 7.3 Configuration link (buyer's chosen setup)
```
https://showroom3d.app/p/k7Xm2pQa9R?f=f2,f4
```
- `f` is a comma-separated list of the selected finish IDs.
- **Not saved in the database.** It lives only in the URL and is built on the buyer's device when they tap Order.
- When the artisan opens it from the WhatsApp message, the viewer reads `f`, applies those finishes, and the artisan sees what the customer configured.
- Unknown or invalid finish IDs in the URL are ignored (fall back to defaults). Never trust the query string.

### 7.4 Security rules
| Risk | Protection |
|---|---|
| Guessing other people's product links | Random 10-char IDs, no sequential IDs. Draft products return 404 on the public route |
| Someone editing another artisan's product | Row Level Security (RLS) in Supabase: only the owner (`auth.uid() = artisan_id`) can insert, update, or delete |
| Draft or unpublished products leaking | Public read policy only where `status = 'published'` |
| Malicious file uploads | Allow-list file types (jpg/png/webp/glb), enforce size limits server-side, random filenames, upload only into the user's own folder |
| Query-string tampering | Validate `f` against the product's actual finish IDs; price is always **recomputed from the database values**, never read from the URL |
| Abuse and scraping | Basic rate limiting on API routes (Vercel/edge middleware) |
| XSS via product name or description | Render as text, never as raw HTML; React escapes by default |
| Secrets | Service keys only in server environment variables, never in client code |
| WhatsApp number exposure | The number is inherently visible inside a `wa.me` link. That's acceptable and expected (it's their business line). Mention in onboarding: "Buyers will contact you on this number" |

### 7.5 Unpublish and delete behavior
- **Unpublish:** link shows a friendly "This product is currently unavailable" page (not an error). The ID is kept.
- **Delete:** product and its files are removed; link shows the same "unavailable" page.

---

## 8. Buyer experience (when the link is opened)

Buyers are phone-first, arriving from WhatsApp or Instagram, with little patience. The page must feel instant, clear, and premium.

### 8.1 Mobile layout (primary)
```
┌──────────────────────────┐
│ [logo] Ade Woodworks  📍Lagos│
│                          │
│                          │
│     FULL-SCREEN 3D       │
│       (rotatable)        │
│                          │
│    ⟲ drag to rotate      │
│  [📷 Photo] [📏 Size]    │
├──────────────────────────┤  ← bottom sheet (glass)
│ Minimalist Dining Table  │
│ ₦175,000                 │
│ Top:  ○ Walnut ● Marble  │
│ Legs: ● Black  ○ Brass   │
│ 180 × 90 × 75 cm   ▲more │
│ ┌──────────────────────┐ │
│ │ 💬 Order via WhatsApp│ │  ← sticky
│ └──────────────────────┘ │
└──────────────────────────┘
```

### 8.2 Desktop layout
- 3D canvas takes about 65% of the width on the left.
- A glassmorphic side panel on the right with the same content as the mobile sheet.
- The WhatsApp button stays pinned at the bottom of the panel.

### 8.3 Properties and elements on the page
| Element | Behavior |
|---|---|
| **Header** | Artisan logo (or initials), business name, location. Small, never blocks the model |
| **3D canvas** | One-finger drag rotates, pinch zooms, two-finger pan disabled (keeps model centered). Rotation and zoom limits so the camera can't go under the floor or far away. Soft auto-rotate until first touch |
| **Hint** | "Drag to rotate" fades out after first interaction |
| **Finish picker** | Swatches grouped by slot, with name label for the selected one. Tap updates the model in real time (about 200ms color transition) |
| **Live price** | Updates instantly: base price + modifiers of selected finishes. Formatted in the product's currency |
| **Dimensions** | Chip showing L × W × H. Tapping **Size** toggles measurement lines in the 3D scene (stretch) |
| **Photo toggle** | Shows the artisan's real photos in a swipeable gallery overlay, so buyers see the real item next to the 3D one |
| **Description** | Expandable section in the sheet |
| **Order via WhatsApp** | Primary button, always visible |
| **Share button** | Native share sheet / copy link (includes current config) |
| **Reset view** | Double-tap on canvas returns to the default angle |

### 8.4 The Order flow
1. Buyer picks finishes and taps **Order via WhatsApp**.
2. App builds the message and opens `wa.me/<artisan number>?text=...`.
3. WhatsApp opens with the message pre-filled; the buyer just taps Send.

**Message the artisan receives:**
```
*NEW INQUIRY / ORDER VIA SHOWROOM 3D* 🛋️✨
──────────────────────────
*Product:* Minimalist Dining Table (SKU: SR-042)
*Selected Finish:* Top: White Carrara Marble, Legs: Black Steel
*Dimensions:* 180cm x 90cm x 75cm
*Quoted Price:* ₦175,000
──────────────────────────
*Configured Preview:* https://showroom3d.app/p/k7Xm2pQa9R?f=f2,f4
──────────────────────────
Hello! I just configured this piece in your 3D Showroom and would like to confirm availability and delivery timelines.
```

### 8.5 States and edge cases
| Situation | What the buyer sees |
|---|---|
| Model loading | Branded loading screen with progress indicator, and the first photo shown immediately so the page never looks empty |
| Link not found or unpublished | Friendly "This product is unavailable" page |
| WebGL not supported or fails | Fallback: reference photo gallery, price, finishes listed as text, and a working WhatsApp button. The sale path never breaks |
| Slow network | Shapes need no downloads (tiny JSON), so this path is fast. `.glb` products show a progress bar |
| Invalid `?f=` values | Ignored; default finishes applied |
| Artisan has no WhatsApp number | Order button hidden; a "Contact unavailable" note (shouldn't happen, because onboarding requires it) |

### 8.6 Visual direction
- **Look:** dark, architectural, premium. Dark background, soft studio lighting, subtle floor shadow, glassmorphic panels.
- **Type:** one clean sans-serif (e.g. Inter or DM Sans). Price is the largest text after the product name.
- **Accent color:** one accent for the WhatsApp button (WhatsApp green is fine and instantly recognizable).
- **Touch targets:** minimum 44px for swatches and buttons.
- **Performance:** limit pixel ratio on mobile (`dpr` max 2), use simple lights and one environment map, no heavy post-processing.

---

## 9. Data model

### 9.1 Tables (Supabase / Postgres)

**`artisans`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Same as `auth.users.id` |
| business_name | text | Required |
| whatsapp | text | Digits only, with country code |
| logo_url | text | Optional |
| location | text | Optional |
| created_at | timestamptz | |

**`products`**
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Internal |
| public_id | text, unique | Random 10 chars, used in the URL |
| artisan_id | uuid (FK → artisans.id) | Owner |
| name | text | |
| description | text | |
| category | text | |
| sku | text | Auto-generated, e.g. `SR-042` |
| photo_urls | text[] | Reference photos |
| model_url | text, nullable | `.glb` URL; if set, viewer uses it |
| parts | jsonb | Shape parts (see below) |
| finishes | jsonb | Finish options (see below) |
| base_price | integer | In smallest sensible unit (whole Naira) |
| currency | text | Default `NGN` |
| dimensions | text | Auto-calculated, editable |
| status | text | `draft` or `published` |
| view_count | integer | Stretch |
| created_at / updated_at | timestamptz | |

### 9.2 Example product JSON (the shared contract)
```json
{
  "publicId": "k7Xm2pQa9R",
  "name": "Minimalist Dining Table",
  "sku": "SR-042",
  "photoUrls": ["https://.../table1.jpg"],
  "modelUrl": null,
  "parts": [
    { "id": "p1", "label": "Tabletop", "shape": "box", "size": [180, 4, 90], "position": [0, 75, 0], "slot": "primary" },
    { "id": "p2", "label": "Leg", "shape": "cylinder", "size": [4, 75], "position": [-80, 37, -40], "slot": "secondary" }
  ],
  "finishes": [
    { "id": "f1", "slot": "primary", "name": "Dark Smoked Walnut", "color": "#3B2219", "textureUrl": null, "priceModifier": 0, "isDefault": true },
    { "id": "f2", "slot": "primary", "name": "White Carrara Marble", "color": "#F0F0F0", "textureUrl": null, "priceModifier": 25000, "isDefault": false },
    { "id": "f3", "slot": "secondary", "name": "Black Steel", "color": "#1A1A1A", "textureUrl": null, "priceModifier": 0, "isDefault": true }
  ],
  "basePrice": 150000,
  "currency": "NGN",
  "dimensions": "180cm x 90cm x 75cm",
  "artisan": { "businessName": "Ade Woodworks", "whatsapp": "2348012345678", "location": "Lagos" }
}
```
**Price rule:** `total = basePrice + sum(priceModifier of the selected finish in each slot)`.

### 9.3 Storage buckets (Supabase Storage, free tier)
| Bucket | Contents | Limits |
|---|---|---|
| `product-photos` | Reference photos | 3MB each, jpg/png/webp |
| `models` | `.glb` files | 2MB, `.glb` only |
| `textures` | Finish texture images | 1MB each |
| `logos` | Artisan logos | 1MB |

Files are stored under `<artisan_id>/<random-name>`. Public read, owner-only write. CORS enabled so the 3D canvas can load files.

---

## 10. Backend scope

| Responsibility | Details |
|---|---|
| Auth | Supabase Auth (email + password), session handling |
| Database | Tables above, with RLS policies |
| Storage | Buckets, size and type validation, CORS |
| API routes (Next.js) | See below |
| ID generation | `nanoid(10)` for `public_id`, uniqueness check with retry |
| WhatsApp link generator | `generateWhatsAppOrderLink()` sanitizes phone, formats price, builds message, URL-encodes |
| Config link encoding | Builds `?f=` from selected finish IDs; viewer decodes and validates |
| Validation | Server-side checks on every write (never rely on the browser alone) |

### API routes
| Method and route | Auth | Purpose |
|---|---|---|
| `POST /api/products` | Artisan | Create product (draft) |
| `PUT /api/products/:id` | Owner | Update product (autosave) |
| `POST /api/products/:id/publish` | Owner | Validate completeness, set `published` |
| `POST /api/products/:id/unpublish` | Owner | Set back to `draft` |
| `DELETE /api/products/:id` | Owner | Delete product and files |
| `GET /api/products` | Artisan | List own products (dashboard) |
| `GET /api/p/:publicId` | Public | Fetch published product for the buyer page |
| `POST /api/upload` | Artisan | Validated file upload, returns URL |
| `GET/PUT /api/profile` | Artisan | Read and update profile |

(With Supabase and RLS, some of these can be direct client calls to save time. Use API routes where validation or ID generation is needed.)

---

## 11. Frontend scope

| Area | Components |
|---|---|
| Shared 3D | `ProductScene` (renders parts JSON or `.glb`, applies selected finishes, lighting, floor shadow, orbit limits). **Used by both the builder preview and the buyer page** |
| Auth | Sign up, log in, onboarding |
| Dashboard | Product grid, product card, empty state |
| Builder | Stepper, template picker, parts list, part editor, finish editor, photo uploader, `.glb` uploader, review and publish |
| Buyer page | Header, canvas, finish picker, price, dimensions, photo gallery, order button, fallback and error pages |

**Stack:** Next.js, React Three Fiber, Drei, Three.js, Tailwind CSS. Hosting on Vercel. Supabase for database, auth, and storage.

---

## 12. Team roles and 48-hour timeline

| Person | Role | Owns |
|---|---|---|
| 1 | 3D / viewer dev | `ProductScene`, materials, camera, lighting, finish switching, `.glb` branch |
| 2 | Builder / dashboard UI dev | Auth screens, dashboard, builder steps, part and finish editors |
| 3 | Backend | Supabase schema, RLS, storage, API routes, `public_id`, WhatsApp generator, config link |
| 4 | Design, content, pitch | Template presets (part sizes and positions), seed products, UI look, copy, pitch and demo script |

### Timeline
**Day 1**
- **Hours 0–3:** Agree on the JSON contract (Section 9.2). Set up repo, deploy blank app to Vercel, create Supabase project.
- **Hours 3–12:** Viewer renders hardcoded JSON. Backend tables, auth, endpoints, WhatsApp generator. Dashboard shell.
- **Hours 12–20:** Finish switching with live price. Builder steps 1–3 with live preview. Table template ready.
- **Hours 20–24:** **End-to-end milestone:** sign up → build → publish → open link → order on WhatsApp.

**Day 2**
- **Hours 24–32:** More templates (chair, shelf, bed). Config link. **Test on a real phone.**
- **Hours 32–40:** UI polish, lighting and scene look, `.glb` upload branch, error and fallback states.
- **Hour 40: CODE FREEZE.**
- **Hours 40–44:** Seed 2–3 polished demo products. Record a backup demo video.
- **Hours 44–48:** Pitch rehearsal only.

---

## 13. Priorities and cut list

**P0 (must ship):** auth, onboarding with WhatsApp number, builder (template + parts + finishes), publish, shareable link, buyer viewer, live price, WhatsApp order with config link.

**P1 (should ship):** dashboard actions (copy link, unpublish, delete), photo gallery on buyer page, error and WebGL fallback pages, more templates.

**P2 (bonus):** `.glb` upload, dimension lines overlay, QR code, view count, Google sign-in.

**Cut without guilt:** artisan storefront and bio page, password reset, payments, drag gizmos, texture maps beyond color or a single image, admin tools.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Builder UI takes too long | Templates do most of the work; numeric inputs instead of drag gizmos |
| 3D performance on low-end phones | Primitive shapes only, capped pixel ratio, simple lighting, test on a real phone by Day 1 evening |
| Members blocked waiting on each other | JSON contract agreed in Hour 0–3; viewer built against hardcoded JSON |
| Live demo failure (Wi-Fi, device) | Backup demo video, pre-seeded products, test the link on the demo phone beforehand |
| Judges ask about photo-to-3D | Pre-generated example (free tools) shown as roadmap, never run live |
| Auth friction in demo | Email verification off; pre-created demo account |

---

## 15. Demo script (3 minutes)

1. **Problem (20s):** flat photos on WhatsApp, buyers hesitate.
2. **Artisan side (60s):** log in → New product → pick Table template → tweak dimensions → add Marble finish with a price modifier → Publish → copy link.
3. **Buyer side (60s):** open link **on a phone** → rotate → switch to marble → price updates → tap Order via WhatsApp → pre-filled message appears.
4. **Closing the loop (20s):** artisan taps the config link in the message and sees the exact setup the buyer chose.
5. **Vision (20s):** upload your own `.glb`, photo-to-3D scanning next (show the pre-generated example), shareable storefronts, and export-ready creative commerce.

**If asked "what if the artisan has no 3D file?"**
"They don't need one. They start from a template, adjust dimensions, add finishes, and publish in minutes. If they already have a 3D model, they can upload it, and photo-to-3D scanning is on our roadmap."

---

## 16. Open decisions for the team (settle in Hour 0)
1. Final product name and domain/subdomain (Vercel free subdomain is fine).
2. Default currency (NGN) and whether to support others.
3. Email/password only, or add Google sign-in.
4. Which 3–4 templates to ship first (suggest: table, chair, shelf, bed).
5. Who records the backup demo video.
