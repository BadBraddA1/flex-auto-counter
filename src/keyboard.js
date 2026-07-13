import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Common browsers / shells Flex might run in */
export const KNOWN_FLEX_APPS = [
  "Google Chrome",
  "Chrome",
  "Safari",
  "Arc",
  "Microsoft Edge",
  "Firefox",
  "Brave Browser",
  "Chromium",
  "Dia",
  "Opera",
  "Vivaldi",
  "Orion",
];

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
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  return stdout.trim();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Frontmost app name (e.g. "Google Chrome", "Terminal"). */
export async function getFrontmostApp() {
  return runAppleScript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  );
}

/** Names of running application processes. */
export async function listRunningAppNames() {
  const raw = await runAppleScript(
    'tell application "System Events" to get name of every application process whose background only is false'
  );
  // osascript returns comma-separated list
  return raw
    .split(", ")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Running apps that look like a browser Flex would use. */
export async function detectFlexApps() {
  const running = await listRunningAppNames();
  const lower = new Set(running.map((n) => n.toLowerCase()));
  return KNOWN_FLEX_APPS.filter((name) => lower.has(name.toLowerCase()));
}

const TERMINAL_APP_RE =
  /^(Terminal|iTerm2?|Cursor|Code|Alacritty|kitty|Warp|Hyper|Tabby|zsh|bash)$/i;

export function looksLikeTerminalApp(name) {
  return TERMINAL_APP_RE.test(String(name || "").trim());
}

/**
 * Bring an app to the front by process name (reliable; Cmd+Tab simulation is not).
 */
export async function activateApp(appName) {
  const safe = escapeAppleScriptString(appName);
  // Prefer System Events frontmost — works even when "tell application" is flaky
  try {
    await runAppleScript(`
      tell application "System Events"
        if exists process "${safe}" then
          set frontmost of process "${safe}" to true
        else
          error "process not found"
        end if
      end tell
    `);
  } catch {
    await runAppleScript(`tell application "${safe}" to activate`);
  }
}

/**
 * Watch for the user to focus Flex/browser, then remember that app name.
 * Call this while instructing them to click Stencil — Terminal may still be
 * frontmost at t=0; by the end they should have clicked the browser.
 */
export async function captureFrontApp({
  seconds = 5,
  onTick,
  rejectTerminal = true,
} = {}) {
  for (let s = seconds; s > 0; s--) {
    onTick?.(s);
    await sleep(1000);
  }
  const front = await getFrontmostApp();
  if (rejectTerminal && looksLikeTerminalApp(front)) {
    throw new Error(
      `Still on “${front}”. Click the Stencil field in your browser, then try again.`
    );
  }
  return front;
}

/** Press Tab `times` times (Serial → Barcode → RFID → Stencil = 3). */
export async function pressTab(times = 1, { delayMs = 80 } = {}) {
  const n = Math.max(0, Number(times) || 0);
  if (n === 0) return;

  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push("key code 48");
    if (delayMs > 0) lines.push(`delay ${delayMs / 1000}`);
  }

  await runAppleScript(`
    tell application "System Events"
      ${lines.join("\n      ")}
    end tell
  `);
}

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

export async function pasteFromClipboard() {
  await runAppleScript(`
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `);
}

export async function pressEnter({ delayMs = 80 } = {}) {
  await runAppleScript(`
    tell application "System Events"
      delay ${Math.max(delayMs, 0) / 1000}
      key code 36
    end tell
  `);
}

/**
 * Activate Flex app → optional Tab → paste stencil → Enter (ADD).
 */
export async function fillStencilAndSubmit(
  text,
  {
    tabs = 0,
    flexApp = null,
    refocus = true,
    refocusDelayMs = 600,
    delayMs = 120,
  } = {}
) {
  if (refocus) {
    if (!flexApp) {
      throw new Error(
        "No Flex/browser app set. Re-run /flexac and pick your browser, or use --app \"Google Chrome\"."
      );
    }
    await activateApp(flexApp);
    await sleep(refocusDelayMs);
    const front = await getFrontmostApp();
    if (looksLikeTerminalApp(front)) {
      throw new Error(
        `Could not switch to “${flexApp}” (still “${front}”). Check Accessibility permission for Terminal, then try again.`
      );
    }
    if (front.toLowerCase() !== String(flexApp).toLowerCase()) {
      // Activated something, but not exact match — continue if not Terminal
      // (process name vs application name can differ slightly)
    }
  }

  if (tabs > 0) {
    await pressTab(tabs, { delayMs: Math.max(delayMs, 80) });
    await sleep(delayMs);
  }

  await copyToClipboard(text);
  await sleep(50);
  await pasteFromClipboard();
  await sleep(delayMs);
  await pressEnter({ delayMs });
}

export async function tabTypeAndEnter(text, opts = {}) {
  await fillStencilAndSubmit(text, opts);
}

export async function typeAndEnter(text, { delayMs = 80 } = {}) {
  await fillStencilAndSubmit(text, { tabs: 0, delayMs, refocus: false });
}

export async function typeText(text) {
  const safe = escapeAppleScriptString(text);
  await runAppleScript(`
    tell application "System Events"
      keystroke "${safe}"
    end tell
  `);
}
