import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const names = [
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "BASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;
const missing = names.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error("Missing environment variables: " + missing.join(", "));
  process.exitCode = 1;
} else if (process.env.SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL ||
           process.env.SUPABASE_ANON_KEY !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Client Supabase URL/anon key must match server configuration.");
  process.exitCode = 1;
} else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("The service-role key must never be used as the public anon key.");
  process.exitCode = 1;
} else {
  console.log("PASS: all six environment variables present; public/server project matches.");
}
