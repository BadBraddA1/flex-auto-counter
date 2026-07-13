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
import { renderStatus, BOLD, GREEN, YELLOW, RED, RESET, CYAN, DIM } from "./status.js";
import { saveLastRun, loadLastRun } from "./state.js";

const DEFAULT_PAD = 3;
const DEFAULT_SEP = " - ";
/** Serial → Barcode → RFID → Stencil (Flex resets to top after each ADD) */
const DEFAULT_TABS = 3;

function printHelp() {
  console.log(`
Flex Auto Counter — auto-fill incrementing Stencil values in Add Serial Unit.

Stencil format:  "USB Drive - 022"

Usage:
  /flexac
  /flexac --name <n> --count <n> --last <n> --app Zen

Workflow (each unit):
  1. Click Add Serial Unit in Flex (cursor starts at the top)
  2. Press Enter in this terminal
  3. We activate your browser, Tab×${DEFAULT_TABS} to Stencil, paste, ADD
  After ADD, Flex jumps back to the top — open Add Serial Unit again for the next one.

Options:
  --app <name>    Browser (e.g. Zen, Google Chrome)
  --tabs <n>      Tabs from top to Stencil (default: ${DEFAULT_TABS})
  --no-refocus    Do not activate the browser
  --pad <n>       Zero-pad width (default: ${DEFAULT_PAD})
  --sep <s>       Separator (default: " - ")
  --delay <ms>    Pause after each ADD (default: 500)
  --refocus-delay <ms>  Wait after activating browser (default: 600)
  --with-serial   You type Serial at the top first each time
  --dry-run
  --help, -h
`);
}

function parseArgs(argv) {
  const args = {
    name: null,
    count: null,
    last: null,
    pad: DEFAULT_PAD,
    separator: DEFAULT_SEP,
    tabs: DEFAULT_TABS,
    delay: 500,
    refocusDelayMs: 600,
    refocus: true,
    flexApp: null,
    withSerial: false,
    dryRun: false,
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
        `Fix: System Settings → Privacy & Security → Accessibility → enable Terminal (and/or iTerm/Cursor).\n` +
        `Also confirm the app name matches the menu bar exactly.`
    );
  }
  process.stdout.write(
    `${GREEN}✓${RESET} Frontmost is now ${BOLD}${front}${RESET}. Switching back so you can press Enter here…\n`
  );
  // Leave browser front for a moment so user sees it worked; they'll click Terminal for Enter
}

async function runSession(args, stencils, rl) {
  const flexApp = await resolveFlexApp(args, rl);
  args.flexApp = flexApp;

  try {
    await smokeTestActivate(flexApp);
  } catch (err) {
    console.error(`${RED}${err.message}${RESET}`);
    process.exit(1);
  }

  const modeLabel = args.withSerial
    ? "with serial (wait for you)"
    : "stencil only";
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

  console.log(`
${BOLD}Ready.${RESET} Each unit: open ${BOLD}Add Serial Unit${RESET} in Flex, then press Enter here.
We Tab×${args.tabs} to Stencil and paste. After ADD, Flex returns to the top — repeat.
`);

  for (const [i, stencil] of stencils.entries()) {
    const next = stencils[i + 1] || null;

    showStatus({
      ...base(),
      current: stencil,
      next,
      phase: args.withSerial
        ? "Open Add Serial Unit, type Serial, Enter here"
        : "Open Add Serial Unit, then Enter here",
    });

    const prompt = args.withSerial
      ? `${YELLOW}▸${RESET} Open ${BOLD}Add Serial Unit${RESET}, type Serial, press ${BOLD}Enter${RESET} for ${BOLD}${stencil}${RESET}… `
      : `${YELLOW}▸${RESET} Open ${BOLD}Add Serial Unit${RESET}, then press ${BOLD}Enter${RESET} for ${BOLD}${stencil}${RESET}… `;
    await rl.question(prompt);

    process.stdout.write(
      `${YELLOW}→${RESET} Activating ${flexApp}, Tab×${args.tabs} → paste ${BOLD}${stencil}${RESET}…\n`
    );

    try {
      await fillStencilAndSubmit(stencil, {
        tabs: args.tabs,
        flexApp,
        refocus: args.refocus,
        refocusDelayMs: args.refocusDelayMs,
        delayMs: 120,
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
          : "Added — open Add Serial Unit again for next",
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

  const wantsWizard =
    argv.length === 0 ||
    (args.name == null &&
      args.count == null &&
      args.last == null &&
      !args.dryRun);

  const rl = readline.createInterface({ input, output });

  try {
    if (wantsWizard) {
      args = await runWizard(rl, args);
    } else if (args.name == null || args.count == null || args.last == null) {
      console.error("Missing required flags: --name, --count, --last");
      console.error("Or run /flexac with no args for the walkthrough.");
      printHelp();
      process.exit(1);
    }

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
        `Will fill ${stencils.length} stencils: ${stencils[0]} … ${stencils.at(-1)}`
      );
      for (const [i, stencil] of stencils.entries()) {
        const steps = [
          "Enter here",
          args.refocus !== false ? `activate ${app}` : null,
          args.tabs > 0 ? `Tab×${args.tabs}` : null,
          `paste "${stencil}"`,
          "Enter",
        ]
          .filter(Boolean)
          .join(" → ");
        console.log(`${i + 1}. ${steps}`);
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
