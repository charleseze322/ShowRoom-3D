export function sanitizePhoneNumber(phone: string): string {
  return String(phone ?? "").replace(/[^0-9]/g, "");
}

export function validatePhoneNumber(phone: string): string {
  const digits = sanitizePhoneNumber(phone);
  if (!/^[0-9]{10,15}$/.test(digits)) {
    throw new RangeError("WhatsApp number must contain 10 to 15 digits, including the country code.");
  }
  return digits;
}
