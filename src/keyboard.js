import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Type text via macOS System Events, then press Return (Enter).
 * Requires Accessibility permission for Terminal/Cursor/iTerm.
 */
export async function typeAndEnter(text, { delayMs = 80 } = {}) {
  if (process.platform !== "darwin") {
    throw new Error(
      "Live typing is only implemented for macOS right now. Use --dry-run elsewhere."
    );
  }

  const safe = escapeAppleScriptString(text);
  const script = `
    tell application "System Events"
      keystroke "${safe}"
      delay ${Math.max(delayMs, 0) / 1000}
      key code 36
    end tell
  `;

  await execFileAsync("osascript", ["-e", script]);
}

/**
 * Brief pause between entries so Flex can clear/ready the Serial Number field.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
