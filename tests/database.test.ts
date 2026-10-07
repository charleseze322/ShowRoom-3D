import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

// Only the external Supabase schema is represented here. The real migration,
// PostgreSQL triggers and RLS run unchanged in embedded PostgreSQL.
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text unique, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text not null,
      owner_id text, metadata jsonb default '{}', unique(bucket_id, name)
    );
    create function storage.foldername(name text) returns text[]
    language sql immutable as $$ select string_to_array(name, '/') $$;
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant select on storage.buckets to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    insert into auth.users (id) values ('${A}'), ('${B}');
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/001_init.sql", import.meta.url), "utf8"));
  await db.query("insert into public.artisans (id,business_name,whatsapp) values ($1,'A Woodworks','2348012345678'),($2,'B Woodworks','2348098765432')", [A,B]);
  await db.query(`insert into public.products (public_id,artisan_id,name,base_price,updated_at)
    values ('draftA0001',$1,'A draft',150000,'2000-01-01'),('draftB0001',$2,'B draft',50000,'2000-01-01')`, [A,B]);
  await db.query(`insert into public.products (public_id,artisan_id,name,base_price,status)
    values ('publicB001',$1,'B published',50000,'published')`, [B]);
});
after(async () => { await db?.close(); });

async function asRole<T>(role: "anon" | "authenticated", id: string, work: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
  try { return await work(); }
  finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}

test("A can read/update own profile but cannot read/update B's profile", async () => {
  await asRole("authenticated", A, async () => {
    const result = await db.query<{id:string}>("select id from public.artisans");
    assert.deepEqual(result.rows.map(row => row.id), [A]);
    const forbidden = await db.query("update public.artisans set business_name='stolen' where id=$1 returning id", [B]);
    assert.equal(forbidden.rows.length, 0);
    assert.equal((await db.query("update public.artisans set location='Lagos' where id=$1 returning id", [A])).rows.length, 1);
  });
});

test("A cannot read, edit or delete B's draft; cannot insert as B", async () => {
  await asRole("authenticated", A, async () => {
    for (const sql of [
      "select id from public.products where public_id='draftB0001'",
      "update public.products set name='stolen' where public_id='draftB0001' returning id",
      "delete from public.products where public_id='draftB0001' returning id",
    ]) assert.equal((await db.query(sql)).rows.length, 0);
    await assert.rejects(db.query("insert into public.products (public_id,artisan_id,name,base_price) values ('wrongOwner',$1,'Stolen',1)", [B]), /row-level security/i);
  });
});

test("published products are public, but B's published product is still not editable by A", async () => {
  await asRole("authenticated", A, async () => {
    assert.equal((await db.query("select id from public.products where public_id='publicB001'")).rows.length, 1);
    assert.equal((await db.query("update public.products set name='stolen' where public_id='publicB001' returning id")).rows.length, 0);
    assert.equal((await db.query("delete from public.products where public_id='publicB001' returning id")).rows.length, 0);
  });
  await asRole("anon", "", async () => {
    const rows = (await db.query<{public_id:string}>("select public_id from public.products")).rows;
    assert.deepEqual(rows.map(row => row.public_id), ["publicB001"]);
    await assert.rejects(db.query("select * from public.artisans"), /permission denied/i);
  });
});

test("database keeps product identity immutable and updates timestamp", async () => {
  await asRole("authenticated", A, async () => {
    for (const change of [
      "public_id='changed001'",
      "id=gen_random_uuid()",
      `artisan_id='${B}'`,
      "sku='SR-999'",
    ]) await assert.rejects(db.query(`update public.products set ${change} where public_id='draftA0001'`), /identity cannot be changed/i);
    const result = await db.query<{updated_at:Date|string}>("update public.products set name='Updated draft' where public_id='draftA0001' returning updated_at");
    assert.ok(new Date(result.rows[0].updated_at).getTime() > Date.UTC(2000,0,1));
  });
});

test("owner can create/delete a draft; defaults and positive-price constraint work", async () => {
  await asRole("authenticated", A, async () => {
    const result = await db.query<{id:string;status:string;sku:string;photo_urls:string[];parts:unknown[];finishes:unknown[]}>(
      "insert into public.products (public_id,artisan_id,name,base_price) values ('tempDraft1',$1,'New draft',1) returning *", [A]);
    const product = result.rows[0];
    assert.equal(product.status, "draft");
    assert.match(product.sku, /^SR-\d{3,}$/);
    assert.deepEqual(product.photo_urls, []);
    assert.deepEqual(product.parts, []);
    assert.deepEqual(product.finishes, []);
    await assert.rejects(db.query("insert into public.products (public_id,artisan_id,name,base_price) values ('badPrice01',$1,'Invalid',0)", [A]), /check constraint/i);
    assert.equal((await db.query("delete from public.products where id=$1 returning id", [product.id])).rows.length, 1);
  });
});

test("four public buckets have exact size/type limits", async () => {
  const result = await db.query<{id:string;public:boolean;file_size_limit:number;allowed_mime_types:string[]}>("select * from storage.buckets order by id");
  assert.equal(result.rows.length, 4);
  for (const bucket of result.rows) {
    assert.equal(bucket.public, true);
    assert.equal(Number(bucket.file_size_limit), bucket.id === "product-photos" ? 3145728 : bucket.id === "models" ? 2097152 : 1048576);
    assert.ok(bucket.allowed_mime_types.includes(bucket.id === "models" ? "model/gltf-binary" : "image/jpeg"));
  }
});

test("storage owner folder policies block cross-user insert, update, move and delete", async () => {
  await asRole("authenticated", B, () => db.query("insert into storage.objects (bucket_id,name) values ('product-photos',$1)", [B+"/photo.jpg"]));
  await asRole("authenticated", A, async () => {
    await assert.rejects(db.query("insert into storage.objects (bucket_id,name) values ('models',$1)", [B+"/model.glb"]), /row-level security/i);
    await db.query("insert into storage.objects (bucket_id,name) values ('textures',$1)", [A+"/texture.png"]);
    assert.equal((await db.query("update storage.objects set name=$1 where name=$2 returning id", [A+"/stolen.jpg",B+"/photo.jpg"])).rows.length, 0);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [B+"/photo.jpg"])).rows.length, 0);
    await assert.rejects(db.query("update storage.objects set name=$1 where name=$2", [B+"/moved.png",A+"/texture.png"]), /row-level security/i);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [A+"/texture.png"])).rows.length, 1);
  });
  await asRole("anon", "", async () => {
    assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
    await assert.rejects(db.query("insert into storage.objects (bucket_id,name) values ('logos','anonymous/logo.png')"), /permission denied/i);
  });
});
