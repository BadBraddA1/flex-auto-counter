import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSerials } from "../src/serials.js";

describe("buildSerials", () => {
  it("increments from last + 1 for the given count", () => {
    assert.deepEqual(buildSerials({ name: "CAM", count: 3, last: 100 }), [
      "CAM101",
      "CAM102",
      "CAM103",
    ]);
  });

  it("supports zero padding and a separator", () => {
    assert.deepEqual(
      buildSerials({ name: "STG", count: 2, last: 7, pad: 3, separator: "-" }),
      ["STG-008", "STG-009"]
    );
  });

  it("rejects bad inputs", () => {
    assert.throws(() => buildSerials({ name: "", count: 1, last: 0 }), /name/);
    assert.throws(() => buildSerials({ name: "A", count: 0, last: 0 }), /count/);
    assert.throws(() => buildSerials({ name: "A", count: 1, last: -1 }), /last/);
  });
});
