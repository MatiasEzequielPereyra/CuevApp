import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exported = {};
  new Function("require", "exports", compiled)(id => mocks[id] ?? require(id), exported);
  return exported;
}
const contracts = load("src/lib/receipts/contracts.ts");
const validation = load("src/lib/receipts/file.ts");
const { validReceiptBytes } = validation;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

function chunk(name, data) {
  const content = Buffer.concat([Buffer.from(name), data]);
  const result = Buffer.alloc(content.length + 8);
  result.writeUInt32BE(data.length);
  content.copy(result, 4);
  result.writeUInt32BE(crc32(content), result.length - 4);
  return result;
}
function png(pixels = [0, 128]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.from(pixels))), chunk("IEND", Buffer.alloc(0)),
  ]);
}
function pdf() {
  let body = "%PDF-1.4\n";
  const offsets = [];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>",
  ];
  for (const [index, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = body.length;
  body += "xref\n0 4\n0000000000 65535 f \n";
  body += offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

test("format validation accepts actual JPEG, PNG, PDF and rejects truncation and type mismatch", async () => {
  const jpeg = readFileSync("docs/brand/reference.jpeg");
  const samples = [
    [jpeg, "image/jpeg"],
    [png(), "image/png"],
    [pdf(), "application/pdf"],
  ];
  for (const [bytes, type] of samples) {
    assert.ok(await validReceiptBytes(bytes, type), type);
    assert.equal(await validReceiptBytes(bytes.subarray(0, bytes.length - 12), type), false);
    assert.equal(await validReceiptBytes(bytes, type === "image/png" ? "image/jpeg" : "image/png"), false);
  }
  const scan = jpeg.indexOf(Buffer.from([0xff, 0xda]));
  assert.ok(scan > 0);
  const corruptJpeg = Buffer.concat([jpeg.subarray(0, scan + 2 + jpeg.readUInt16BE(scan + 2)), Buffer.from([0xff, 0xd9])]);
  assert.equal(await validReceiptBytes(corruptJpeg, "image/jpeg"), false, "valid markers but unreadable scan");
  const damaged = png();
  damaged[45] ^= 1;
  assert.equal(await validReceiptBytes(damaged, "image/png"), false);
  assert.equal(await validReceiptBytes(png([5, 128]), "image/png"), false, "invalid PNG scan filter");
  assert.equal(await validReceiptBytes(png([0]), "image/png"), false, "valid CRC with missing pixels");
  assert.equal(await validReceiptBytes(Buffer.from(pdf().toString().replace(/\d{10} 00000 n/, "0000000010 00000 n")), "application/pdf"), false);
  assert.equal(await validReceiptBytes(Buffer.alloc(10485761), "application/pdf"), false);
});

const actor = "11111111-1111-4111-8111-111111111111";
const session = "22222222-2222-4222-8222-222222222222";
const period = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const origin = "https://app.example.test";

function scenario({ user = { id: actor }, bytes = png(), available = true, storageType = "image/png" } = {}) {
  const writes = [], signatures = [];
  let finalized = false;
  const client = {
    auth: {
      getUser: async () => ({ data: { user } }),
      getClaims: async () => ({ data: { claims: { sub: actor, session_id: session } } }),
    },
    rpc: async (name, params) => {
      assert.equal(name, "cueva_receipt_prepare");
      if (params.p_period !== period) return { error: { code: "42501" } };
      return { data: finalized ? "submitted" : "eligible" };
    },
    from: () => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: available ? { object_path: "scoped.png", media_type: "image/png" } : null }),
    }) }) }),
  };
  const storage = {
    from: bucket => {
      assert.equal(bucket, contracts.receiptBucket);
      return {
        exists: async () => ({ data: false }),
        createSignedUploadUrl: async (path, options) => {
          signatures.push({ path, options });
          return { data: { signedUrl: "https://storage.example.test/signed-upload" } };
        },
        download: async () => ({ data: new Blob([bytes], { type: storageType }) }),
        createSignedUrl: async (path, seconds, options) => {
          signatures.push({ path, seconds, options });
          return { data: { signedUrl: "https://storage.example.test/private" } };
        },
      };
    },
  };
  const { POST, GET } = load("src/app/api/comprobantes/route.ts", {
    "next/server": { NextResponse: {
      json: Response.json,
      redirect: (url, options) => new Response(null, { ...options, headers: { ...options.headers, location: url } }),
    } },
    "@/lib/product-auth/server": {
      productConfig: () => ({ origin }), userClient: async () => client,
      serviceClient: () => ({ rpc: async (name, params) => {
        assert.equal(name, "cueva_receipt_submit");
        writes.push(params); finalized = true;
        return { data: params.p_id };
      } }),
    },
    "@/lib/routines/request": load("src/lib/routines/request.ts"),
    "@/lib/routines/types": { uuid: /^[a-f0-9-]{36}$/i },
    "@/lib/receipts/contracts": contracts,
    "@/lib/receipts/file": validation,
    "@/lib/receipts/server": {
      receiptStorage: async () => storage,
      receiptError: () => ({ status: 403, message: "Acceso restringido" }),
    },
  });
  const payload = { id, period, extension: "png", type: "image/png", size: bytes.length, hash: sha(bytes) };
  const send = (action, override = {}, requestOrigin = origin) => POST(new Request(`${origin}/api/comprobantes`, {
    method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" },
    body: JSON.stringify({ ...payload, action, ...override }),
  }));
  const open = () => GET(new Request(`${origin}/api/comprobantes?id=${id}`));
  return { send, open, writes, signatures };
}

test("upload keeps a validated immutable path and exact retry writes once", async () => {
  const fixture = scenario();
  assert.equal((await fixture.send("prepare")).status, 200);
  assert.deepEqual(fixture.signatures, [{ path: `${actor}/${period}/${id}.png`, options: { upsert: false } }]);
  assert.equal((await fixture.send("submit")).status, 200);
  assert.equal((await fixture.send("submit")).status, 200);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].p_actor, actor);
  assert.equal(fixture.writes[0].p_session, session);
});

test("file, metadata, origin and cross-member failures do not create presentations", async () => {
  const fixture = scenario();
  assert.equal((await fixture.send("prepare", { size: 10485761 })).status, 413);
  assert.equal((await fixture.send("prepare", { extension: "pdf" })).status, 415);
  assert.equal((await fixture.send("prepare", { period: id })).status, 403);
  assert.equal((await fixture.send("prepare", {}, "https://other.example.test")).status, 403);
  assert.equal((await fixture.send("submit", { hash: "0".repeat(64) })).status, 422);
  assert.equal(fixture.signatures.length, 0);
  assert.equal(fixture.writes.length, 0);
  const broken = scenario({ bytes: Buffer.from("fake png") });
  assert.equal((await broken.send("submit")).status, 422);
  assert.equal(broken.writes.length, 0);
  const wrongType = scenario({ storageType: "application/pdf" });
  assert.equal((await wrongType.send("submit")).status, 422);
  assert.equal(wrongType.writes.length, 0);
});

test("file access signs only authorized rows and never caches the redirect", async () => {
  for (const fixture of [scenario({ user: null }), scenario({ available: false })]) {
    assert.equal((await fixture.open()).status, 403);
    assert.equal(fixture.signatures.length, 0);
  }
  const fixture = scenario();
  const response = await fixture.open();
  assert.equal(response.status, 307);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(fixture.signatures, [{ path: "scoped.png", seconds: 60, options: { download: "comprobante.png" } }]);
});
