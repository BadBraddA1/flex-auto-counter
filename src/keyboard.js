import { execFile, spawn } from "node:child_process";
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

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Frontmost app name (e.g. "Google Chrome", "Terminal"). */
export async function getFrontmostApp() {
  assertMac();
  const { stdout } = await execFileAsync("osascript", [
    "-e",
    'tell application "System Events" to get name of first application process whose frontmost is true',
  ]);
  return stdout.trim();
}

const TERMINAL_APP_RE =
  /^(Terminal|iTerm2?|Cursor|Code|Alacritty|kitty|Warp|Hyper|Tabby)$/i;

export function looksLikeTerminalApp(name) {
  return TERMINAL_APP_RE.test(String(name || "").trim());
}

/**
 * Cmd+Tab once — returns to the previous app (Flex) after you pressed Enter in Terminal.
 */
export async function switchToPreviousApp() {
  await runAppleScript(`
    tell application "System Events"
      key code 48 using {command down}
    end tell
  `);
}

/** Press Tab `times` times (Serial → Barcode → RFID → Stencil = 3). */
export async function pressTab(times = 1, { delayMs = 80 } = {}) {
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

/** Copy text to the macOS clipboard via pbcopy. */
export function copyToClipboard(text) {
  assertMac();
  return new Promise((resolve, reject) => {
    const child = spawn("pbcopy");
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pbcopy exited ${code}`));
    });
    child.stdin.write(String(text));
    child.stdin.end();
  });
}

/** Paste (Cmd+V) into the focused field. */
export async function pasteFromClipboard() {
  await runAppleScript(`
    tell application "System Events"
      keystroke "v" using command down
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
 * Reliable fill: optional Cmd+Tab back to Flex → Tab to field → paste stencil → Enter.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.tabs=0]
 * @param {boolean} [opts.refocus=false] - Cmd+Tab to previous app first
 * @param {number} [opts.refocusDelayMs=500]
 * @param {number} [opts.delayMs=100]
 */
export async function fillStencilAndSubmit(
  text,
  { tabs = 0, refocus = false, refocusDelayMs = 500, delayMs = 100 } = {}
) {
  if (refocus) {
    await switchToPreviousApp();
    await sleep(refocusDelayMs);
    const front = await getFrontmostApp();
    if (looksLikeTerminalApp(front)) {
      throw new Error(
        `Flex is not frontmost (still “${front}”). Click into the Stencil (or Serial) field in Flex, then press Enter here again.`
      );
    }
  }

  if (tabs > 0) {
    await pressTab(tabs, { delayMs: Math.max(delayMs, 80) });
    await sleep(delayMs);
  }

  await copyToClipboard(text);
  await sleep(40);
  await pasteFromClipboard();
  await sleep(delayMs);
  await pressEnter({ delayMs });
}

/** @deprecated use fillStencilAndSubmit */
export async function tabTypeAndEnter(text, opts = {}) {
  await fillStencilAndSubmit(text, opts);
}

export async function typeAndEnter(text, { delayMs = 80 } = {}) {
  await fillStencilAndSubmit(text, { tabs: 0, delayMs });
}

export async function typeText(text) {
  const safe = escapeAppleScriptString(text);
  await runAppleScript(`
    tell application "System Events"
      keystroke "${safe}"
    end tell
  `);
}
