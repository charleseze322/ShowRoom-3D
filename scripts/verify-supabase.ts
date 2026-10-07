import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Configure .env.local first; see docs/SETUP.md.");
  const options = { auth: { persistSession:false, autoRefreshToken:false } };
  const anon = createClient(url, anonKey, options);
  const admin = createClient(url, serviceKey, options);
  const { data: products, error: productError } = await anon.from("products").select("status").limit(100);
  if (productError) throw new Error("Published product read failed; check migration and public SELECT policy.");
  if (products.some(product => product.status !== "published")) throw new Error("A draft is publicly readable.");
  const { error: artisanError } = await anon.from("artisans").select("id").limit(1);
  if (!artisanError) throw new Error("Anonymous artisan table access must be denied.");
  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) throw new Error("Bucket check failed; check server-only service-role key.");
  const limits: Record<string,number> = { "product-photos":3145728, models:2097152, textures:1048576, logos:1048576 };
  for (const [name,limit] of Object.entries(limits)) {
    const bucket = buckets.find(item => item.id === name);
    if (!bucket?.public || Number(bucket.file_size_limit) !== limit) throw new Error("Bucket public/size configuration failed: "+name);
  }
  console.log("PASS: live published-only read, private artisan access, four public bucket limits.");
  console.log("This read-only check does not replace the local A/B RLS tests or hosted upload/CORS checks.");
}
main().catch(() => {
  console.error("Supabase verification failed. Check configuration/migration against docs/SETUP.md; no credentials are printed.");
  process.exitCode = 1;
});
