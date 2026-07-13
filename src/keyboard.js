import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Common browsers / shells Flex might run in */
export const KNOWN_FLEX_APPS = [
  "Zen",
  "zen",
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

export async function getFrontmostApp() {
  return runAppleScript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  );
}

export async function listRunningAppNames() {
  const raw = await runAppleScript(
    'tell application "System Events" to get name of every application process whose background only is false'
  );
  return raw
    .split(", ")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function detectFlexApps() {
  const running = await listRunningAppNames();
  const lowerToActual = new Map(running.map((n) => [n.toLowerCase(), n]));
  const found = [];
  for (const name of KNOWN_FLEX_APPS) {
    const actual = lowerToActual.get(name.toLowerCase());
    if (actual && !found.some((f) => f.toLowerCase() === actual.toLowerCase())) {
      found.push(actual);
    }
  }
  return found;
}

export async function resolveProcessName(appName) {
  const running = await listRunningAppNames();
  const want = String(appName || "").trim().toLowerCase();
  const hit = running.find((n) => n.toLowerCase() === want);
  if (hit) return hit;
  if (want === "zen browser") {
    const zen = running.find((n) => n.toLowerCase() === "zen");
    if (zen) return zen;
  }
  return appName;
}

const TERMINAL_APP_RE =
  /^(Terminal|iTerm2?|Cursor|Code|Alacritty|kitty|Warp|Hyper|Tabby|zsh|bash)$/i;

export function looksLikeTerminalApp(name) {
  return TERMINAL_APP_RE.test(String(name || "").trim());
}

export async function activateApp(appName) {
  const processName = await resolveProcessName(appName);
  const safe = escapeAppleScriptString(processName);
  const safeApp = escapeAppleScriptString(
    processName.toLowerCase() === "zen" ? "Zen" : processName
  );

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
    await runAppleScript(`tell application "${safeApp}" to activate`);
  }
}

/**
 * One Tab at a time (separate osascript calls) so focus can settle.
 * Batching Tabs in one script was landing on RFID / Location.
 */
export async function pressTab(times = 1, { delayMs = 200 } = {}) {
  const n = Math.max(0, Number(times) || 0);
  for (let i = 0; i < n; i++) {
    await runAppleScript(`
      tell application "System Events"
        key code 48
      end tell
    `);
    await sleep(delayMs);
  }
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

/** Select all in the focused field (Cmd+A) before paste. */
export async function selectAll() {
  await runAppleScript(`
    tell application "System Events"
      keystroke "a" using command down
    end tell
  `);
}

export async function pasteFromClipboard() {
  await runAppleScript(`
    tell application "System Events"
      keystroke "v" using command down
    end tell
  `);
}

export async function pressEnter({ delayMs = 100 } = {}) {
  await sleep(delayMs);
  await runAppleScript(`
    tell application "System Events"
      key code 36
    end tell
  `);
}

/**
 * Activate Flex → Tab to Stencil (slowly) → select-all → paste → Enter.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.refocus=true] activate browser first
 * @param {boolean} [opts.submit=true] press Enter after paste
 */
export async function fillStencilAndSubmit(
  text,
  {
    tabs = 0,
    flexApp = null,
    refocus = true,
    refocusDelayMs = 700,
    tabDelayMs = 220,
    delayMs = 150,
    submit = true,
  } = {}
) {
  if (refocus) {
    if (!flexApp) {
      throw new Error(
        'No Flex/browser app set. Re-run /flexac and pick your browser, or use --app Zen.'
      );
    }
    await activateApp(flexApp);
    await sleep(refocusDelayMs);
    const front = await getFrontmostApp();
    if (looksLikeTerminalApp(front)) {
      throw new Error(
        `Could not switch to “${flexApp}” (still “${front}”). Check Accessibility for Terminal.`
      );
    }
  }

  if (tabs > 0) {
    await pressTab(tabs, { delayMs: tabDelayMs });
    await sleep(delayMs);
  }

  await copyToClipboard(text);
  await sleep(40);
  await selectAll();
  await sleep(60);
  await pasteFromClipboard();
  await sleep(delayMs);

  if (submit) {
    await pressEnter({ delayMs });
  }
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
