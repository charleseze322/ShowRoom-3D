import assert from "node:assert/strict";
import fixture from "../lib/mock-product.json";
import { test } from "node:test";
import { encodeConfig, decodeConfig } from "../lib/config";
import { calculatePrice, formatPrice } from "../lib/pricing";
import { generateWhatsAppOrderLink } from "../lib/whatsapp";
import { validatePhoneNumber } from "../lib/phone";
import { calculateDimensions } from "../lib/dimensions";
import {
  productSchema, publishProductSchema, productCreateSchema, productUpdateSchema,
  profileUpdateSchema, signupSchema, partSchema, finishSchema,
} from "../lib/schemas";
import type { Product, Part } from "../lib/types";

const product: Product = productSchema.parse(fixture);

test("mock product matches the public contract and passes publish completeness", () => {
  assert.ok(publishProductSchema.safeParse(fixture).success);
  assert.equal(product.publicId.length, 10);
  assert.ok(!("id" in product));
  assert.ok(!("artisanId" in product));
  assert.ok(!("email" in product.artisan));
  assert.equal(calculateDimensions(product.parts), product.dimensions);
});

test("WhatsApp preserves exact PRD message, sanitized phone, currency and configured preview", () => {
  const showroomUrl = "https://showroom3d.vercel.app/p/"+product.publicId+encodeConfig(["f2","f3"]);
  const link = generateWhatsAppOrderLink({
    phoneNumber:"+234 (803) 123-4567", productName:product.name, sku:product.sku,
    finish:"Top: White Carrara Marble, Legs: Black Steel",
    dimensions:"180cm x 90cm x 75cm", currency:"NGN",
    price:calculatePrice(product,["f2","f3"]), showroomUrl,
  });
  assert.match(link, /^https:\/\/wa\.me\/2348031234567\?text=/);
  const message = new URL(link).searchParams.get("text");
  assert.equal(message, [
    "*NEW INQUIRY / ORDER VIA SHOWROOM 3D* 🛋️✨",
    "──────────────────────────",
    "*Product:* Minimalist Dining Table (SKU: SR-042)",
    "*Selected Finish:* Top: White Carrara Marble, Legs: Black Steel",
    "*Dimensions:* 180cm x 90cm x 75cm",
    "*Quoted Price:* ₦175,000",
    "──────────────────────────",
    "*Configured Preview:* "+showroomUrl,
    "──────────────────────────",
    "Hello! I just configured this piece in your 3D Showroom and would like to confirm availability and delivery timelines.",
  ].join("\n"));
  assert.match(link, /%E2%82%A6/);
  assert.equal(formatPrice(175000,"USD"), "$175,000");
  assert.equal(formatPrice(175000,"EUR"), "€175,000");
});

test("phone sanitizing accepts 10/15 digits and rejects short/long/empty phones", () => {
  assert.equal(validatePhoneNumber("+234 (801) 234-5678"), "2348012345678");
  assert.equal(validatePhoneNumber("1234567890"), "1234567890");
  assert.equal(validatePhoneNumber("123456789012345"), "123456789012345");
  for (const phone of ["abc","","123456789","1234567890123456"]) {
    assert.throws(() => validatePhoneNumber(phone), /10 to 15 digits/);
  }
});

test("configuration encodes exact comma format, deduplicates, handles empty/query objects", () => {
  assert.equal(encodeConfig(["f2","f4"]), "?f=f2,f4");
  assert.equal(encodeConfig(["f2","f2","f4"]), "?f=f2,f4");
  assert.equal(encodeConfig([]), "");
  assert.deepEqual(decodeConfig("?f=f2,f4",product), ["f2","f4"]);
  assert.deepEqual(decodeConfig(new URLSearchParams("f=f2,f4"),product), ["f2","f4"]);
  assert.deepEqual(decodeConfig(null,product), ["f1","f3"]);
});

test("unknown finish IDs are ignored and missing slots get defaults", () => {
  assert.deepEqual(decodeConfig("?f=unknown,f2,unknown2",product), ["f2","f3"]);
  assert.deepEqual(decodeConfig("?f=unknown",product), ["f1","f3"]);
  assert.deepEqual(decodeConfig("?f=",product), ["f1","f3"]);
  assert.deepEqual(decodeConfig("?f=f4",product), ["f1","f4"]);
});

test("price math adds one modifier per slot, ignores fake price URL and duplicate/alternative IDs", () => {
  assert.equal(calculatePrice(product,["f2","f4"]), 190000);
  assert.equal(calculatePrice(product,["f2","f2","f1","f4","f3"]), 190000);
  assert.equal(calculatePrice(product,["bogus"]), 150000);
  assert.equal(calculatePrice(product,[]), 150000);
  assert.equal(calculatePrice(product,decodeConfig("?f=f2,f4&price=1",product)), 190000);
  assert.deepEqual(decodeConfig("?f=f1,f2,f3,f4",product), ["f1","f3"]);
});

test("default modifiers are included; unused slot finishes do not add to the quote", () => {
  const changed: Product = structuredClone(product);
  changed.finishes.find(finish => finish.id === "f3")!.priceModifier = 5000;
  changed.finishes.push({id:"a1",slot:"accent",name:"Unused",color:"#FFFFFF",textureUrl:null,priceModifier:90000,isDefault:true});
  assert.equal(calculatePrice(changed,["f2","a1"]), 180000);
});

test("GLB without parts uses primary defaults and draft with no model has no slots", () => {
  const glb = {...product,modelUrl:"https://example.com/model.glb",parts:[]};
  assert.deepEqual(decodeConfig(null,glb), ["f1"]);
  assert.equal(calculatePrice(glb,["f2","f4"]), 175000);
  assert.deepEqual(decodeConfig(null,{...glb,modelUrl:null}), []);
});

test("invalid price/modifier and unsafe totals are rejected", () => {
  assert.throws(() => calculatePrice({...product,basePrice:0},[]), /positive integer/);
  assert.throws(() => calculatePrice({...product,basePrice:1.5},[]), /positive integer/);
  const bad: Product = structuredClone(product);
  bad.finishes[0].priceModifier = -1;
  assert.throws(() => calculatePrice(bad,[]), /non-negative integer/);
  bad.finishes[0].priceModifier = Number.MAX_SAFE_INTEGER;
  assert.throws(() => calculatePrice(bad,[]), /too large/);
  assert.throws(() => formatPrice(1,"not-a-currency"), /three-letter/);
});

test("draft creation allows incomplete model/finishes, defaults values, rejects client identity/status", () => {
  const parsed = productCreateSchema.parse({name:"Dining table",basePrice:150000,category:"Table"});
  assert.deepEqual(parsed.parts,[]);
  assert.deepEqual(parsed.finishes,[]);
  assert.deepEqual(parsed.photoUrls,[]);
  assert.equal(parsed.currency,"NGN");
  assert.equal(parsed.modelUrl,null);
  for (const invalid of [
    {name:"ab",basePrice:1,category:"Table"},
    {name:"Table",basePrice:0,category:"Table"},
    {name:"Table",basePrice:1.5,category:"Table"},
    {name:"Table",basePrice:1,category:"Unknown"},
    {name:"Table",basePrice:1,category:"Table",artisanId:"other-user"},
    {name:"Table",basePrice:1,category:"Table",publicId:"forced-id"},
    {name:"Table",basePrice:1,category:"Table",status:"published"},
  ]) assert.equal(productCreateSchema.safeParse(invalid).success,false);
});

test("autosave schema accepts partial editable fields, rejects limits, unknown keys and duplicate IDs", () => {
  assert.ok(productUpdateSchema.safeParse({description:"A new description"}).success);
  assert.ok(productUpdateSchema.safeParse({parts:[]}).success);
  for (const invalid of [
    {}, {sku:"SR-000"}, {basePrice:-1}, {price:1},
    {description:"a".repeat(501)}, {name:"a".repeat(61)},
    {photoUrls:Array(4).fill("https://example.com/photo.png")},
    {parts:[product.parts[0],product.parts[0]]},
    {parts:Array.from({length:41},(_,i)=>({...product.parts[0],id:"p"+i}))},
    {finishes:[product.finishes[0],product.finishes[0]]},
    {finishes:Array.from({length:21},(_,i)=>({...product.finishes[0],id:"f"+i,isDefault:false}))},
    {finishes:[product.finishes[0],{...product.finishes[1],isDefault:true}]},
  ]) assert.equal(productUpdateSchema.safeParse(invalid).success,false);
});

test("part and finish schemas enforce exact shape sizes, finite positions, slots, color and modifiers", () => {
  assert.ok(partSchema.safeParse(product.parts[0]).success);
  const sphere = {...product.parts[0],shape:"sphere",size:[4]};
  assert.ok(partSchema.safeParse(sphere).success);
  for (const part of [
    {...sphere,size:[4,4]},
    {...product.parts[0],size:[4,-1,5]},
    {...product.parts[0],position:[0,Infinity,0]},
    {...product.parts[0],position:[0,0]},
    {...product.parts[0],slot:"bad"},
  ]) assert.equal(partSchema.safeParse(part).success,false);
  for (const finish of [
    {...product.finishes[0],color:"#fff"},
    {...product.finishes[0],priceModifier:-1},
    {...product.finishes[0],priceModifier:1.5},
    {...product.finishes[0],textureUrl:"javascript:alert(1)"},
  ]) assert.equal(finishSchema.safeParse(finish).success,false);
});

test("publish schema reports missing model, photos and slot defaults; permits GLB primary finish", () => {
  assert.equal(publishProductSchema.safeParse({...product,photoUrls:[]}).success,false);
  assert.equal(publishProductSchema.safeParse({...product,parts:[],modelUrl:null}).success,false);
  assert.equal(publishProductSchema.safeParse({...product,finishes:product.finishes.filter(finish=>finish.slot!=="secondary")}).success,false);
  assert.equal(publishProductSchema.safeParse({...product,artisan:{...product.artisan,whatsapp:""}}).success,false);
  assert.ok(publishProductSchema.safeParse({...product,modelUrl:"https://example.com/model.glb",parts:[]}).success);
});

test("profile defaults business name later from metadata, but WhatsApp remains required", () => {
  assert.deepEqual(profileUpdateSchema.parse({whatsapp:"+234 801 234 5678"}), {whatsapp:"2348012345678"});
  assert.ok(!profileUpdateSchema.safeParse({businessName:"Ade"}).success);
  assert.ok(!profileUpdateSchema.safeParse({whatsapp:"abc"}).success);
  assert.ok(signupSchema.safeParse({email:"demo@example.com",password:"test-password",businessName:"Ade Woodworks"}).success);
});

test("dimensions combine offsets, cylinder diameter/height and sphere diameter", () => {
  const parts: Part[] = [
    {id:"b",label:"Box",shape:"box",size:[10,20,30],position:[-10,0,0],slot:"primary"},
    {id:"c",label:"Cylinder",shape:"cylinder",size:[5,10],position:[10,0,0],slot:"secondary"},
    {id:"s",label:"Sphere",shape:"sphere",size:[4],position:[0,20,0],slot:"accent"},
  ];
  assert.equal(calculateDimensions(parts), "30cm x 30cm x 34cm");
  assert.equal(calculateDimensions([]), null);
});
