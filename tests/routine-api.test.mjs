import test from "node:test";
import assert from "node:assert/strict";
import { routineReadIsConsistent } from "../src/lib/routines/request.ts";

test("accepts routine and text document from the same revision", () => {
  assert.equal(routineReadIsConsistent(4, 4), true);
});

test("rejects a mixed snapshot when a save lands between parallel reads", () => {
  assert.equal(routineReadIsConsistent(4, 5), false);
  assert.equal(routineReadIsConsistent(5, 4), false);
});

test("accepts a legacy empty routine but rejects a missing text document for a saved revision", () => {
  assert.equal(routineReadIsConsistent(0, null), true);
  assert.equal(routineReadIsConsistent(4, null), false);
  assert.equal(routineReadIsConsistent(undefined, undefined), true);
});
