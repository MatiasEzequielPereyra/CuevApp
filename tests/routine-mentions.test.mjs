import test from "node:test";
import assert from "node:assert/strict";
import {
  codePointOffsetToUtf16,
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
  assert.equal(codePointSlice("🏋️‍♀️ Sentadilla búlgara", 7, 25), "Sentadilla búlgara");
});

test("validates repeated exercise references and exact text ranges", () => {
  const content = "🏋️ Press de banca y Press de banca";
  const first = content.indexOf("Press");
  const second = content.lastIndexOf("Press");
  const mentions = validateRoutineMentions(content, [
    { exercise_id: exercise, start: utf16OffsetToCodePoint(content, first), end: utf16OffsetToCodePoint(content, first + 15), text: "Press de banca" },
    { exercise_id: exercise, start: utf16OffsetToCodePoint(content, second), end: utf16OffsetToCodePoint(content, second + 15), text: "Press de banca" },
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
