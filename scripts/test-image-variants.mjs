// How a consumer asks for a smaller copy of a picture (variantUrl), how the
// serve route reads the ask (variantWidth), how the sibling is named, and
// that headers are read safely: sniffImage, imageSize and the pixel budget
// that keeps a huge declared picture from ever reaching a decoder. The
// variant writer itself is gone with the WASM codecs, so nothing writes the
// siblings; the naming survives for the ones already on disk.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import zlib from "node:zlib";

register("./lib/register-alias.mjs", import.meta.url);

const { imageSize, isVariantFileName, pixelBudget, sniffImage, variantFileName, variantUrl, variantWidth } = await import(
  "../src/lib/image-format.ts"
);

const repo = path.resolve(import.meta.dirname, "..");
const samplePng = path.join(repo, "public", "assets", "themes", "default", "diffuse-dark.png");

// A PNG of random RGBA noise: incompressible, so it weighs what a piece of
// scene art weighs.
function noisePng(width, height) {
  const crc = (bytes) => {
    let value = ~0;
    for (const byte of bytes) {
      value ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
      }
    }
    return (~value) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.concat([Buffer.from([0]), randomBytes(width * 4)]));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
}

await test("variantUrl adds ?w= only to the server's own pictures", () => {
  assert.equal(variantUrl("/generated/a.png", 256), "/generated/a.png?w=256");
  assert.equal(variantUrl("/uploads/b.jpg", 1024), "/uploads/b.jpg?w=1024");
  assert.equal(variantUrl("/generated/a.png?w=256", 1024), "/generated/a.png?w=256");
  assert.equal(variantUrl("/generated/a.png#x", 256), "/generated/a.png#x");
  for (const src of [
    "/assets/placeholders/x.webp",
    "data:image/png;base64,AAAA",
    "blob:https://localhost/1234",
    "https://example.com/generated/a.png",
    "generated/a.png",
    "",
  ]) {
    assert.equal(variantUrl(src, 256), src);
  }
});

await test("variantWidth accepts the two sizes the server names and nothing else", () => {
  assert.equal(variantWidth("256"), 256);
  assert.equal(variantWidth("1024"), 1024);
  for (const value of ["512", "0", "-256", "abc", "", null, undefined, "256px", "1e3"]) {
    assert.equal(variantWidth(value), null, `w=${value}`);
  }
});

await test("variant names are the stem plus .w<size>.webp, and recognisable", () => {
  assert.equal(variantFileName("a.png", 256), "a.w256.webp");
  assert.equal(variantFileName("1789851467166-openai-map.png", 1024), "1789851467166-openai-map.w1024.webp");
  assert.equal(variantFileName("photo.JPEG", 256), "photo.w256.webp");
  assert.equal(variantFileName("noext", 256), "noext.w256.webp");
  assert.ok(isVariantFileName("a.w256.webp"));
  assert.ok(isVariantFileName("a.w1024.webp"));
  assert.ok(!isVariantFileName("a.webp"));
  assert.ok(!isVariantFileName("a.w512.webp"));
  assert.ok(!isVariantFileName("a.w256.png"));
});

await test("sniffImage and imageSize read PNG, JPEG and every WebP header shape", () => {
  const png = fs.readFileSync(samplePng);
  assert.equal(sniffImage(png)?.format, "png");
  assert.deepEqual(imageSize(png), { width: 1024, height: 1024 });
  assert.equal(sniffImage(Buffer.from("<svg onload=alert(1)>")), null);
  // A VP8L (lossless) header: 3x2 pixels.
  const lossless = Buffer.alloc(30);
  lossless.write("RIFF", 0, "ascii");
  lossless.write("WEBP", 8, "ascii");
  lossless.write("VP8L", 12, "ascii");
  lossless[20] = 0x2f;
  lossless.writeUInt32LE((3 - 1) | ((2 - 1) << 14), 21);
  assert.equal(sniffImage(lossless)?.format, "webp");
  assert.deepEqual(imageSize(lossless), { width: 3, height: 2 });
});

// A small file whose header declares a huge picture: the IHDR of a 1x1 PNG
// rewritten, which is all a decoder reads before it allocates.
function declaredPng(width, height) {
  const png = Buffer.from(noisePng(1, 1));
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}

await test("a picture's pixel count is read from its header, before anything decodes it", () => {
  assert.equal(pixelBudget(noisePng(4, 4)), "ok");
  assert.equal(pixelBudget(declaredPng(8000, 8000)), "ok");
  assert.equal(pixelBudget(declaredPng(8001, 8000)), "over");
  assert.equal(pixelBudget(declaredPng(30000, 30000)), "over");
  assert.equal(pixelBudget(Buffer.from("not a picture at all")), "unknown");
});

console.log(`image variants: ${passed} tests passed`);
