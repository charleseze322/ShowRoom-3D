export type Slot = "primary" | "secondary" | "accent";
export type Position = [number, number, number];
type PartBase = { id: string; label: string; position: Position; slot: Slot };
export type Part =
  | (PartBase & { shape: "box"; size: [number, number, number] })
  | (PartBase & { shape: "cylinder"; size: [number, number] })
  | (PartBase & { shape: "sphere"; size: [number] });

export interface Finish {
  id: string;
  slot: Slot;
  name: string;
  color: string;
  textureUrl: string | null;
  priceModifier: number;
  isDefault: boolean;
}
export interface Artisan {
  businessName: string;
  whatsapp: string;
  location?: string | null;
  logoUrl?: string | null;
}
export interface Product {
  publicId: string;
  name: string;
  sku: string;
  photoUrls: string[];
  modelUrl: string | null;
  parts: Part[];
  finishes: Finish[];
  basePrice: number;
  currency: string;
  dimensions: string;
  artisan: Artisan;
}
export type Category = "Table" | "Chair" | "Shelf" | "Bed" | "Other";
export type ProductStatus = "draft" | "published";
export interface OwnerProduct extends Product {
  id: string;
  description: string | null;
  category: Category | null;
  status: ProductStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}
export type ConfigurableProduct = Pick<Product, "parts" | "finishes" | "modelUrl">;
export type PriceableProduct = ConfigurableProduct & Pick<Product, "basePrice">;
export type EditableProduct = Pick<Product,
  "name" | "photoUrls" | "modelUrl" | "parts" | "finishes" | "basePrice" | "currency" | "dimensions"
> & { description: string | null; category: Category };
export type ProductCreateInput = Pick<EditableProduct, "name" | "basePrice" | "category"> & Partial<Omit<EditableProduct, "name" | "basePrice" | "category">>;
export type ProductUpdateInput = Partial<EditableProduct>;
