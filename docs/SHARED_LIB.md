# Shared frontend/backend contract

`lib/mock-product.json` is development fixture data, never a database/API fallback.
Its photoUrls contain authorized placeholders; replace that array with real uploaded
URLs later. Geometry sizes/positions are centimetres. Box uses [x,y,z], cylinder
[radius,height], sphere [radius]; positions are centres. Bounds display X x Z x Y.

Both API handlers and components import the same browser-safe modules:
- `@/lib/types`: Product, Part, Finish, Artisan, OwnerProduct and input types.
- `@/lib/schemas`: signupSchema, profileUpdateSchema, partSchema, finishSchema,
  productSchema, productCreateSchema, productUpdateSchema, publishProductSchema.
- `@/lib/config`: encodeConfig, decodeConfig, resolveSelectedFinishes, getUsedSlots.
- `@/lib/pricing`: calculatePrice, formatPrice.
- `@/lib/whatsapp`: generateWhatsAppOrderLink.
- `@/lib/dimensions`: calculateDimensions.

```ts
import fixture from "@/lib/mock-product.json";
import { productSchema } from "@/lib/schemas";
import { decodeConfig, encodeConfig, resolveSelectedFinishes } from "@/lib/config";
import { calculatePrice } from "@/lib/pricing";
import { generateWhatsAppOrderLink } from "@/lib/whatsapp";

const product = productSchema.parse(fixture); // development only
const ids = decodeConfig("?f=f2,f4", product);
const showroomUrl = "https://your-app.vercel.app/p/" + product.publicId + encodeConfig(ids);
const link = generateWhatsAppOrderLink({
  phoneNumber: product.artisan.whatsapp,
  productName: product.name,
  sku: product.sku,
  finish: resolveSelectedFinishes(product, ids).map(f => f.slot + ": " + f.name).join(", "),
  dimensions: product.dimensions,
  price: calculatePrice(product, ids),
  currency: product.currency,
  showroomUrl,
});
```

Price comes from product values, never URL/client totals. First valid requested finish
per used slot wins; duplicates/unknown IDs are ignored, omitted slots use defaults.
GLB-only products use primary as the whole-model finish slot. Drafts can temporarily
have no default; publishing rejects that. Empty encodeConfig returns an empty string.

At signup (Phase 2), set `options: {data: {business_name: businessName}}`.
Profile update businessName is optional only when metadata supplies a valid name.
The route must merge that default and validate artisanSchema before inserting.
ProfileUpdateSchema alone intentionally does not guarantee the metadata exists.

Autosave parses productUpdateSchema, merges stored data, then revalidates;
productCreateSchema defaults arrays/currency/model. Publish validates merged product
using publishProductSchema plus the category requirement. The DB intentionally
allows owner status changes: completeness enforcement belongs to the API.
Asset ownership and upload file signatures are server checks in later phases,
not claimed by shared URL schemas.

```powershell
npm run test:shared
npm test
npm run typecheck
npm run lint
npm run build
```
