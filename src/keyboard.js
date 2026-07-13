import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function assertMac() {
  if (process.platform !== "darwin") {
    throw new Error(
      "Live typing is only implemented for macOS right now. Use --dry-run elsewhere."
    );
  }
}

async function runAppleScript(script) {
  assertMac();
  await execFileAsync("osascript", ["-e", script]);
}

/** Press Tab `times` times (Serial → Barcode → RFID → Stencil = 3). */
export async function pressTab(times = 1, { delayMs = 40 } = {}) {
  const n = Math.max(0, Number(times) || 0);
  if (n === 0) return;

  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push("key code 48"); // Tab
    if (delayMs > 0) lines.push(`delay ${delayMs / 1000}`);
  }

  await runAppleScript(`
    tell application "System Events"
      ${lines.join("\n      ")}
    end tell
  `);
}

/** Type text into the focused field (no Enter). */
export async function typeText(text) {
  const safe = escapeAppleScriptString(text);
  await runAppleScript(`
    tell application "System Events"
      keystroke "${safe}"
    end tell
  `);
}

/** Press Return / Enter. */
export async function pressEnter({ delayMs = 80 } = {}) {
  await runAppleScript(`
    tell application "System Events"
      delay ${Math.max(delayMs, 0) / 1000}
      key code 36
    end tell
  `);
}

/**
 * Tab to the target field (optional), type text, then press Enter (ADD).
 */
export async function tabTypeAndEnter(text, { tabs = 0, delayMs = 80 } = {}) {
  if (tabs > 0) {
    await pressTab(tabs);
    await sleep(delayMs);
  }
  await typeText(text);
  await pressEnter({ delayMs });
}

/**
 * Type text via macOS System Events, then press Return (Enter).
 * Requires Accessibility permission for Terminal/Cursor/iTerm.
 */
export async function typeAndEnter(text, { delayMs = 80 } = {}) {
  await tabTypeAndEnter(text, { tabs: 0, delayMs });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
