import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoSource } from "../src/lib/routines/video-source.ts";

const id = "dQw4w9WgXcQ";

test("accepts HTTPS Supabase Storage signed URLs", () => {
  assert.deepEqual(parseVideoSource({ kind: "storage", src: "https://project.supabase.co/storage/v1/object/sign/videos/a.mp4?token=abc" }), {
    kind: "storage",
    src: "https://project.supabase.co/storage/v1/object/sign/videos/a.mp4?token=abc",
  });
});

test("accepts loopback HTTP Storage URLs only for the isolated local lab", () => {
  assert.equal(parseVideoSource({ kind: "storage", src: "http://127.0.0.1:55424/storage/v1/object/sign/videos/a.mp4?token=local" })?.kind, "storage");
});

test("rejects non-HTTPS remote, malformed and credential-bearing storage URLs", () => {
  for (const src of ["http://localhost:54321/video.mp4", "http://192.168.1.5/video.mp4", "javascript:alert(1)", "https://user:pass@example.com/video.mp4", "not a url"]) {
    assert.equal(parseVideoSource({ kind: "storage", src }), null, src);
  }
});

test("accepts supported canonical YouTube URL forms only when ID matches", () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://youtu.be/${id}`,
  ]) assert.deepEqual(parseVideoSource({ kind: "youtube", id, url }), { kind: "youtube", id, url });
});

test("rejects malformed YouTube IDs, mismatched URLs, unsafe hosts and extra URL components", () => {
  const invalid = [
    { kind: "youtube", id: "short", url: `https://youtu.be/${id}` },
    { kind: "youtube", id, url: "https://evil.example/" + id },
    { kind: "youtube", id, url: `https://youtu.be/${"A".repeat(11)}` },
    { kind: "youtube", id, url: `http://youtu.be/${id}` },
    { kind: "youtube", id, url: `https://youtu.be/${id}?autoplay=1` },
    { kind: "youtube", id, url: `https://youtu.be/${id}#fragment` },
    { kind: "youtube", id, url: `https://user@youtu.be/${id}` },
    { kind: "youtube", id, url: `https://www.youtube.com/watch?v=${id}&redirect=evil` },
    { kind: "youtube", id, url: `https://www.youtube.com/watch?v=${id}&v=${id}` },
  ];
  for (const value of invalid) assert.equal(parseVideoSource(value), null);
});

test("rejects null, arrays, unknown kinds and malformed objects", () => {
  for (const value of [null, [], "video", {}, { kind: "vimeo", url: "https://vimeo.com" }]) {
    assert.equal(parseVideoSource(value), null);
  }
});
