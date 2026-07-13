import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCounterValues } from "../src/serials.js";

describe("buildCounterValues", () => {
  it("matches Flex stencil style: Name - 022", () => {
    assert.deepEqual(
      buildCounterValues({
        name: "USB Drive",
        count: 3,
        last: 21,
        pad: 3,
        separator: " - ",
      }),
      ["USB Drive - 022", "USB Drive - 023", "USB Drive - 024"]
    );
  });

  it("increments from last + 1 for the given count", () => {
    assert.deepEqual(
      buildCounterValues({ name: "CAM", count: 3, last: 100, pad: 0, separator: "" }),
      ["CAM101", "CAM102", "CAM103"]
    );
  });

  it("supports custom padding and separators", () => {
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
