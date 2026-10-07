import { z } from "zod";
import { getUsedSlots } from "./config";
import { sanitizePhoneNumber } from "./phone";

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "ID can contain letters, digits, underscores and hyphens.");
const size = z.number().finite().positive();
const position = z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
export const slotSchema = z.enum(["primary", "secondary", "accent"]);
const partFields = { id, label:z.string().trim().min(1).max(60), position, slot:slotSchema };
export const partSchema = z.discriminatedUnion("shape", [
  z.strictObject({...partFields, shape:z.literal("box"), size:z.tuple([size,size,size])}),
  z.strictObject({...partFields, shape:z.literal("cylinder"), size:z.tuple([size,size])}),
  z.strictObject({...partFields, shape:z.literal("sphere"), size:z.tuple([size])}),
]);
const url = z.url({protocol:/^https?$/});
export const finishSchema = z.strictObject({
  id, slot:slotSchema, name:z.string().trim().min(1).max(60),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a six-digit hex color."),
  textureUrl:url.nullable(),
  priceModifier:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  isDefault:z.boolean(),
});
export const whatsappSchema = z.string().transform(sanitizePhoneNumber)
  .refine(phone => /^[0-9]{10,15}$/.test(phone), "WhatsApp number must contain 10 to 15 digits, including the country code.");
export const artisanSchema = z.strictObject({
  businessName:z.string().trim().min(1).max(100),
  whatsapp:whatsappSchema,
  location:z.string().trim().max(100).nullable().optional(),
  logoUrl:url.nullable().optional(),
});
export const profileUpdateSchema = artisanSchema.partial({businessName:true});
export const signupSchema = z.strictObject({
  email:z.email(),
  password:z.string().min(6).max(128),
  businessName:artisanSchema.shape.businessName,
});

const parts = z.array(partSchema).max(40);
const finishes = z.array(finishSchema).max(20);
const editableFields = {
  name:z.string().trim().min(3).max(60),
  description:z.string().max(500).nullable(),
  category:z.enum(["Table","Chair","Shelf","Bed","Other"]),
  photoUrls:z.array(url).max(3),
  modelUrl:url.nullable(),
  parts,
  finishes,
  basePrice:z.number().int().positive().max(2147483647),
  currency:z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  dimensions:z.string().trim().max(100),
};

function uniqueIds(
  value: {parts?: {id:string}[]; finishes?: {id:string;slot:string;isDefault:boolean}[]},
  ctx: z.RefinementCtx,
) {
  for (const key of ["parts","finishes"] as const) {
    const entries = value[key];
    if (entries && new Set(entries.map(item => item.id)).size !== entries.length) {
      ctx.addIssue({code:"custom",path:[key],message:"IDs must be unique."});
    }
  }
  for (const slot of ["primary","secondary","accent"]) {
    if ((value.finishes ?? []).filter(finish => finish.slot === slot && finish.isDefault).length > 1) {
      ctx.addIssue({code:"custom",path:["finishes"],message:"Only one default finish is allowed per slot."});
    }
  }
}
export const productCreateSchema = z.strictObject({
  ...editableFields,
  description:editableFields.description.optional(),
  photoUrls:editableFields.photoUrls.default([]),
  modelUrl:editableFields.modelUrl.default(null),
  parts:parts.default([]),
  finishes:finishes.default([]),
  currency:editableFields.currency.default("NGN"),
  dimensions:editableFields.dimensions.optional(),
}).superRefine(uniqueIds);
export const productUpdateSchema = z.strictObject(editableFields).partial()
  .refine(value => Object.keys(value).length > 0, "Provide at least one editable field.")
  .superRefine(uniqueIds);

export const productSchema = z.strictObject({
  publicId:z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  name:editableFields.name,
  sku:z.string().regex(/^SR-[0-9]{3,}$/),
  photoUrls:editableFields.photoUrls,
  modelUrl:editableFields.modelUrl,
  parts, finishes,
  basePrice:editableFields.basePrice,
  currency:editableFields.currency,
  dimensions:editableFields.dimensions,
  artisan:artisanSchema,
}).superRefine(uniqueIds);

// Completeness belongs to publish API, not to draft autosave or the database.
export const publishProductSchema = productSchema.superRefine((product, ctx) => {
  if (!product.photoUrls.length) ctx.addIssue({code:"custom",path:["photoUrls"],message:"Add at least one photo."});
  if (!product.modelUrl && !product.parts.length) ctx.addIssue({code:"custom",path:["parts"],message:"Add a model or at least one part."});
  for (const slot of getUsedSlots(product)) {
    if (!product.finishes.some(finish => finish.slot === slot && finish.isDefault)) {
      ctx.addIssue({code:"custom",path:["finishes"],message:"Add a default finish for "+slot+"."});
    }
  }
});
