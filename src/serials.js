/**
 * Build the list of serial numbers to enter.
 *
 * @param {object} opts
 * @param {string} opts.name - Prefix before the number (e.g. "CAM")
 * @param {number} opts.count - How many units to add
 * @param {number} opts.last - Last number already used (next starts at last + 1)
 * @param {number} [opts.pad=0] - Zero-pad width (0 = no padding)
 * @param {string} [opts.separator=""] - Between name and number (e.g. "-" → CAM-101)
 * @returns {string[]}
 */
export function buildSerials({ name, count, last, pad = 0, separator = "" }) {
  if (!name || typeof name !== "string") {
    throw new Error("name is required");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }
  if (!Number.isInteger(last) || last < 0) {
    throw new Error("last must be a non-negative integer");
  }
  if (!Number.isInteger(pad) || pad < 0) {
    throw new Error("pad must be a non-negative integer");
  }

  const serials = [];
  for (let i = 1; i <= count; i++) {
    const n = last + i;
    const num = pad > 0 ? String(n).padStart(pad, "0") : String(n);
    serials.push(`${name}${separator}${num}`);
  }
  return serials;
}
