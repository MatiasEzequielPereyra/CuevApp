import test from "node:test";
import assert from "node:assert/strict";
import {
  codePointOffsetToUtf16,
  rebaseRoutineMentions,
  codePointSlice,
  utf16OffsetToCodePoint,
  validateRoutineMentions,
} from "../src/lib/routines/mentions.ts";

const exercise = "11111111-1111-4111-8111-111111111111";
const otherExercise = "22222222-2222-4222-8222-222222222222";

test("converts UTF-16 cursor positions to Unicode code-point offsets", () => {
  const text = "🏋️‍♀️ Press de banca";
  const utf16 = text.indexOf("Press");
  assert.equal(utf16OffsetToCodePoint(text, utf16), Array.from(text.slice(0, utf16)).length);
  assert.equal(codePointOffsetToUtf16(text, utf16OffsetToCodePoint(text, utf16)), utf16);
});

test("rejects a cursor offset that splits a surrogate pair", () => {
  assert.throws(() => utf16OffsetToCodePoint("A😀B", 2), RangeError);
});

test("slices by code points, preserving emoji and accented names", () => {
  assert.equal(codePointSlice("🏋️‍♀️ Sentadilla búlgara", 6, 24), "Sentadilla búlgara");
});

test("validates repeated exercise references and exact text ranges", () => {
  const content = "🏋️ Press de banca y Press de banca";
  const first = content.indexOf("Press");
  const second = content.lastIndexOf("Press");
  const mentions = validateRoutineMentions(content, [
    { exercise_id: exercise, start: utf16OffsetToCodePoint(content, first), end: utf16OffsetToCodePoint(content, first + 14), text: "Press de banca" },
    { exercise_id: exercise, start: utf16OffsetToCodePoint(content, second), end: utf16OffsetToCodePoint(content, second + 14), text: "Press de banca" },
  ]);
  assert.equal(mentions.length, 2);
  assert.equal(mentions[0].exercise_id, mentions[1].exercise_id);
});

test("rejects mismatched text, overlapping ranges, invalid UUIDs and excessive entries", () => {
  const content = "Sentadilla búlgara";
  const valid = { exercise_id: exercise, start: 0, end: 18, text: content };
  assert.throws(() => validateRoutineMentions(content, [{ ...valid, text: "Sentadilla" }]), TypeError);
  assert.throws(() => validateRoutineMentions(content, [valid, { ...valid, exercise_id: otherExercise }]), TypeError);
  assert.throws(() => validateRoutineMentions(content, [{ ...valid, exercise_id: "not-a-uuid" }]), TypeError);
  assert.throws(() => validateRoutineMentions(content, [valid], 0), TypeError);
});

test("rejects invalid or out-of-range offsets", () => {
  assert.throws(() => codePointOffsetToUtf16("texto", -1), RangeError);
  assert.throws(() => codePointSlice("texto", 3, 2), RangeError);
  assert.throws(() => validateRoutineMentions("texto", [
    { exercise_id: exercise, start: 0, end: 99, text: "texto" },
  ]), TypeError);
});

test("rebases references after Unicode insertions before and after them", () => {
  const original = "🏋️ Plan: Sentadilla y Remo";
  const start = Array.from(original.slice(0, original.indexOf("Sentadilla"))).length;
  const mention = { exercise_id: exercise, start, end: start + Array.from("Sentadilla").length, text: "Sentadilla" };

  const withPrefix = "🏃 Nota: " + original;
  const shifted = rebaseRoutineMentions(original, withPrefix, [mention]);
  const shift = Array.from("🏃 Nota: ").length;
  assert.deepEqual(shifted, [{ ...mention, start: mention.start + shift, end: mention.end + shift }]);

  const withSuffix = original + " — 3 series";
  assert.deepEqual(rebaseRoutineMentions(original, withSuffix, [mention]), [mention]);
});

test("drops a reference when an edit intersects its text and preserves later references", () => {
  const original = "Sentadilla / Remo";
  const first = { exercise_id: exercise, start: 0, end: 10, text: "Sentadilla" };
  const second = { exercise_id: otherExercise, start: 13, end: 17, text: "Remo" };
  const edited = "SentadillX / Remo";
  assert.deepEqual(rebaseRoutineMentions(original, edited, [first, second]), [
    { ...second, start: 13, end: 17 },
  ]);
});

test("keeps a mention when editing immediately before it and removes it when deleting inside it", () => {
  const original = "A Sentadilla B";
  const mention = { exercise_id: exercise, start: 2, end: 12, text: "Sentadilla" };
  assert.deepEqual(rebaseRoutineMentions(original, "Nota: " + original, [mention]), [
    { ...mention, start: 8, end: 18 },
  ]);
  assert.deepEqual(rebaseRoutineMentions(original, "A Sentadlla B", [mention]), []);
});
