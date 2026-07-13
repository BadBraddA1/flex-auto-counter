import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCounterValues } from "../src/serials.js";

describe("buildCounterValues", () => {
  it("increments from last + 1 for the given count", () => {
    assert.deepEqual(buildCounterValues({ name: "CAM", count: 3, last: 100 }), [
      "CAM101",
      "CAM102",
      "CAM103",
    ]);
  });

  it("supports zero padding and a separator", () => {
    assert.deepEqual(
      buildCounterValues({ name: "STG", count: 2, last: 7, pad: 3, separator: "-" }),
      ["STG-008", "STG-009"]
    );
  });

  it("rejects bad inputs", () => {
    assert.throws(() => buildCounterValues({ name: "", count: 1, last: 0 }), /name/);
    assert.throws(() => buildCounterValues({ name: "A", count: 0, last: 0 }), /count/);
    assert.throws(() => buildCounterValues({ name: "A", count: 1, last: -1 }), /last/);
  });
});
