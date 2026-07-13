#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildCounterValues } from "./serials.js";
import {
  fillStencilAndSubmit,
  sleep,
  detectFlexApps,
  activateApp,
  getFrontmostApp,
  looksLikeTerminalApp,
} from "./keyboard.js";
import { runWizard } from "./wizard.js";
import { runCalibrate } from "./calibrate.js";
import { renderStatus, BOLD, GREEN, YELLOW, RED, RESET, CYAN, DIM } from "./status.js";
import { saveLastRun, loadLastRun } from "./state.js";

const DEFAULT_PAD = 3;
const DEFAULT_SEP = " - ";
/** Fallback before calibration — run /flexac --calibrate to learn the real count */
const DEFAULT_TABS = 3;
/** Wait after ADD so Flex can reset focus to the top before the next Tab cycle */
const DEFAULT_DELAY = 900;

function printHelp() {
  console.log(`
Flex Auto Counter — fill Stencil in Add Serial Unit (auto-count).

Stencil format:  "USB Drive - 022"

Usage:
  /flexac                         Walkthrough
  /flexac --calibrate --app Zen   Learn how many Tabs reach Stencil (do this first)
  /flexac -n "USB Drive" -c 10 -l 40 --app Zen

Stencil-only (no serial):
  1. Open Add Serial Unit once
  2. Press Enter here once
  3. We run the whole batch: Tab → paste → ADD → wait → Tab → … (no more Enter)

With serial (--with-serial):
  Each unit: open Add Serial Unit, type Serial, Enter here — we Tab to Stencil + ADD

Options:
  --calibrate     Find the correct Tab count to Stencil (saves it)
  --app <name>    Browser (Zen, Google Chrome, …)
  --tabs <n>      Tabs from top to Stencil (default: saved or ${DEFAULT_TABS})
  --with-serial   Pause for Serial each unit
  --delay <ms>    Pause after each ADD (default: ${DEFAULT_DELAY})
  --refocus-delay <ms>  Wait after activating browser (default: 700)
  --no-refocus    Do not activate browser
  --pad / --sep / --dry-run / --help
`);
}

function parseArgs(argv) {
  const args = {
    name: null,
    count: null,
    last: null,
    pad: DEFAULT_PAD,
    separator: DEFAULT_SEP,
    tabs: null, // null = use saved / default
    tabsExplicit: false,
    delay: DEFAULT_DELAY,
    refocusDelayMs: 700,
    refocus: true,
    flexApp: null,
    withSerial: false,
    dryRun: false,
    calibrate: false,
    help: false,
    wizard: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value after ${a}`);
      return v;
    };

    switch (a) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--calibrate":
        args.calibrate = true;
        break;
      case "--with-serial":
        args.withSerial = true;
        break;
      case "--no-refocus":
        args.refocus = false;
        break;
      case "--app":
        args.flexApp = next();
        break;
      case "--name":
      case "-n":
        args.name = next();
        break;
      case "--count":
      case "-c":
        args.count = Number(next());
        break;
      case "--last":
      case "-l":
        args.last = Number(next());
        break;
      case "--pad":
        args.pad = Number(next());
        break;
      case "--sep":
        args.separator = next();
        break;
      case "--tabs":
        args.tabs = Number(next());
        args.tabsExplicit = true;
        break;
      case "--delay":
        args.delay = Number(next());
        break;
      case "--refocus-delay":
        args.refocusDelayMs = Number(next());
        break;
      case "--countdown":
        next();
        break;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

function resolveTabs(args) {
  if (args.tabsExplicit && Number.isInteger(args.tabs)) return args.tabs;
  if (Number.isInteger(args.tabs)) return args.tabs;
  const saved = loadLastRun();
  if (Number.isInteger(saved.tabs)) return saved.tabs;
  return DEFAULT_TABS;
}

function showStatus(state) {
  if (process.stdout.isTTY) {
    console.clear();
  }
  console.log(renderStatus(state));
}

async function resolveFlexApp(args, rl) {
  if (args.flexApp) return args.flexApp;

  const saved = loadLastRun();
  if (saved.flexApp) return saved.flexApp;

  let detected = [];
  try {
    detected = await detectFlexApps();
  } catch {
    detected = [];
  }

  if (detected.length === 1) {
    console.log(`${DIM}Using detected browser: ${detected[0]}${RESET}`);
    return detected[0];
  }

  if (detected.length > 1) {
    console.log(`\n${BOLD}Which browser is Flex in?${RESET}`);
    detected.forEach((name, i) => {
      console.log(`  ${CYAN}${i + 1}${RESET}) ${name}`);
    });
    const pick = await rl.question(`${CYAN}?${RESET} Choose 1–${detected.length} [1]: `);
    const idx = pick.trim() === "" ? 1 : Number(pick);
    if (Number.isInteger(idx) && idx >= 1 && idx <= detected.length) {
      return detected[idx - 1];
    }
  }

  const typed = await rl.question(
    `${CYAN}?${RESET} App name (e.g. Zen, Google Chrome) [Zen]: `
  );
  return typed.trim() || "Zen";
}

async function smokeTestActivate(flexApp) {
  process.stdout.write(
    `${YELLOW}→${RESET} Testing focus: activating ${BOLD}${flexApp}${RESET}…\n`
  );
  await activateApp(flexApp);
  await sleep(500);
  const front = await getFrontmostApp();
  if (looksLikeTerminalApp(front)) {
    throw new Error(
      `Could not bring “${flexApp}” forward (still “${front}”).\n` +
        `Fix: System Settings → Privacy & Security → Accessibility → enable Terminal.`
    );
  }
  process.stdout.write(
    `${GREEN}✓${RESET} Frontmost is now ${BOLD}${front}${RESET}.\n`
  );
}

async function runSession(args, stencils, rl) {
  const flexApp = await resolveFlexApp(args, rl);
  args.flexApp = flexApp;
  args.tabs = resolveTabs(args);

  const saved = loadLastRun();
  if (!args.tabsExplicit && !Number.isInteger(saved.tabs)) {
    console.log(`
${YELLOW}Tab count not calibrated yet${RESET} (using ${args.tabs}).
If values land in RFID / Location / wrong fields, run:
  ${BOLD}/flexac --calibrate --app ${flexApp}${RESET}
`);
  }

  try {
    await smokeTestActivate(flexApp);
  } catch (err) {
    console.error(`${RED}${err.message}${RESET}`);
    process.exit(1);
  }

  const modeLabel = args.withSerial
    ? "with serial"
    : "stencil only (auto batch)";
  const recent = [];
  let done = 0;

  const base = () => ({
    name: args.name,
    mode: `${modeLabel} · ${flexApp} · Tab×${args.tabs}`,
    total: stencils.length,
    done,
    current: null,
    next: stencils[done] || null,
    phase: "Starting",
    recent: [...recent],
  });

  if (args.withSerial) {
    console.log(`
${BOLD}Ready.${RESET} Each unit: open Add Serial Unit, type Serial, Enter here.
`);
  } else {
    console.log(`
${BOLD}Ready.${RESET} Open ${BOLD}Add Serial Unit${RESET} once, then press Enter here ${BOLD}once${RESET}.
We will add all ${stencils.length} stencils automatically (Tab×${args.tabs} each time).
Leave Flex alone until it finishes — don’t click the terminal mid-run.
`);
  }

  // Stencil-only: one start signal, then continuous
  if (!args.withSerial) {
    showStatus({
      ...base(),
      phase: "Open Add Serial Unit, then Enter here to start the batch",
    });
    await rl.question(
      `${YELLOW}▸${RESET} Open ${BOLD}Add Serial Unit${RESET}, press ${BOLD}Enter${RESET} to start batch… `
    );
  }

  for (const [i, stencil] of stencils.entries()) {
    const next = stencils[i + 1] || null;
    const isFirst = i === 0;

    if (args.withSerial) {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: "Open Add Serial Unit, type Serial, Enter here",
      });
      await rl.question(
        `${YELLOW}▸${RESET} Open Add Serial Unit, type Serial, press ${BOLD}Enter${RESET} for ${BOLD}${stencil}${RESET}… `
      );
    } else {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: isFirst
          ? `Starting batch → ${stencil}`
          : `Auto-continuing → ${stencil}`,
      });
      // Tiny pause so status can render; stay off the keyboard
      await sleep(150);
    }

    process.stdout.write(
      `${YELLOW}→${RESET} [${i + 1}/${stencils.length}] Tab×${args.tabs} → ${BOLD}${stencil}${RESET}…\n`
    );

    try {
      await fillStencilAndSubmit(stencil, {
        tabs: args.tabs,
        flexApp,
        // First keystroke (or after serial wait): activate browser.
        // Later auto items: stay in Flex (refocus false) so we don't fight focus.
        refocus: args.refocus && (args.withSerial || isFirst),
        refocusDelayMs: args.refocusDelayMs,
        delayMs: 150,
        tabDelayMs: 220,
      });
    } catch (err) {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: `Error: ${err.message}`,
      });
      console.error(`${RED}${err.message}${RESET}`);
      const savePartial = await rl.question(
        `Save progress as last=${args.last + done}? (y/n) [n]: `
      );
      if (["y", "yes"].includes(savePartial.trim().toLowerCase()) && done > 0) {
        saveLastRun({
          name: args.name,
          last: args.last + done,
          count: args.count,
          withSerial: args.withSerial,
          tabs: args.tabs,
          flexApp,
        });
      }
      process.exit(1);
    }

    done = i + 1;
    recent.push(stencil);
    showStatus({
      ...base(),
      current: stencil,
      next: stencils[done] || null,
      phase:
        done === stencils.length
          ? "Done"
          : args.withSerial
            ? "Added — next unit when ready"
            : `Added — waiting ${args.delay}ms for form reset…`,
      recent: [...recent],
    });

    if (i < stencils.length - 1) {
      await sleep(args.delay);
    }
  }

  const confirm = await rl.question(
    `${GREEN}▸${RESET} Did Flex look correct? Save last=${BOLD}${args.last + stencils.length}${RESET}? (y/n) [y]: `
  );
  const ok =
    confirm.trim() === "" ||
    ["y", "yes"].includes(confirm.trim().toLowerCase());

  if (ok) {
    saveLastRun({
      name: args.name,
      last: args.last + stencils.length,
      count: args.count,
      withSerial: args.withSerial,
      tabs: args.tabs,
      flexApp,
    });
    console.log(
      `${GREEN}${BOLD}Saved.${RESET} Next last number: ${BOLD}${args.last + stencils.length}${RESET}\n`
    );
  } else {
    console.log(
      `${YELLOW}Not saved.${RESET} Keep last number: ${BOLD}${args.last}${RESET}\n`
    );
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(1);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const rl = readline.createInterface({ input, output });

  try {
    if (args.calibrate) {
      const flexApp = await resolveFlexApp(args, rl);
      await runCalibrate(rl, { flexApp });
      return;
    }

    const wantsWizard =
      argv.length === 0 ||
      (args.name == null &&
        args.count == null &&
        args.last == null &&
        !args.dryRun);

    if (wantsWizard) {
      args = await runWizard(rl, args);
    } else if (args.name == null || args.count == null || args.last == null) {
      console.error("Missing required flags: --name, --count, --last");
      console.error("Or run /flexac with no args for the walkthrough.");
      printHelp();
      process.exit(1);
    }

    args.tabs = resolveTabs(args);
    if (!Number.isInteger(args.tabs) || args.tabs < 0) {
      console.error("--tabs must be a non-negative integer");
      process.exit(1);
    }

    let stencils = args.stencils;
    if (!stencils) {
      try {
        stencils = buildCounterValues({
          name: args.name,
          count: args.count,
          last: args.last,
          pad: args.pad,
          separator: args.separator,
        });
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    }

    if (args.dryRun) {
      const app = args.flexApp || "(your browser)";
      console.log(
        `Mode: ${args.withSerial ? "with-serial" : "stencil-only auto batch"}`
      );
      console.log(
        `Will fill ${stencils.length} stencils: ${stencils[0]} … ${stencils.at(-1)} (Tab×${args.tabs})`
      );
      if (!args.withSerial) {
        console.log(
          `1. Enter once → activate ${app} → then for each: Tab×${args.tabs} → paste → Enter → wait`
        );
        stencils.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
      } else {
        stencils.forEach((s, i) => {
          console.log(
            `${i + 1}. Enter here → activate ${app} → Tab×${args.tabs} → paste "${s}" → Enter`
          );
        });
      }
      console.log("Dry run complete (nothing typed).");
      return;
    }

    await runSession(args, stencils, rl);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
