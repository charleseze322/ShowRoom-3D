import { validatePhoneNumber } from "./phone";
import { formatPrice } from "./pricing";

export interface WhatsAppOrderInput {
  phoneNumber: string;
  productName: string;
  sku: string;
  finish: string;
  dimensions: string;
  /** Always obtain this from calculatePrice(product, selectedFinishIds). */
  price: number;
  currency?: string;
  /** Full /p/<publicId> URL including encodeConfig(selectedFinishIds). */
  showroomUrl: string;
}

export function generateWhatsAppOrderLink({
  phoneNumber, productName, sku, finish, dimensions, price,
  currency = "NGN", showroomUrl,
}: WhatsAppOrderInput): string {
  const phone = validatePhoneNumber(phoneNumber);
  const preview = new URL(showroomUrl);
  if (!["https:", "http:"].includes(preview.protocol)) throw new RangeError("Preview must be an HTTP or HTTPS URL.");
  const message = [
    "*NEW INQUIRY / ORDER VIA SHOWROOM 3D* 🛋️✨",
    "──────────────────────────",
    `*Product:* ${productName} (SKU: ${sku})`,
    `*Selected Finish:* ${finish}`,
    `*Dimensions:* ${dimensions}`,
    `*Quoted Price:* ${formatPrice(price, currency)}`,
    "──────────────────────────",
    `*Configured Preview:* ${showroomUrl}`,
    "──────────────────────────",
    "Hello! I just configured this piece in your 3D Showroom and would like to confirm availability and delivery timelines.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
