#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildCounterValues } from "./serials.js";
import { tabTypeAndEnter, sleep } from "./keyboard.js";
import { runWizard } from "./wizard.js";
import { renderStatus, BOLD, GREEN, YELLOW, RED, RESET } from "./status.js";
import { saveLastRun } from "./state.js";

/** Serial → Barcode → RFID → Stencil */
const DEFAULT_TABS_TO_STENCIL = 3;
/** Matches Flex inventory stencils like "USB Drive - 022" */
const DEFAULT_PAD = 3;
const DEFAULT_SEP = " - ";

function printHelp() {
  console.log(`
Flex Auto Counter — auto-fill incrementing Stencil values in Add Serial Unit.

Stencil format (matches Flex lists):
  "<name> - <zero-padded number>"  →  e.g. USB Drive - 022, USB Drive - 023

Usage:
  /flexac                         Interactive walkthrough + live status
  /flexac --name <n> --count <n> --last <n> [options]

Required (flag mode):
  --name, -n      Stencil name/prefix (e.g. "USB Drive")
  --count, -c     How many units to add
  --last, -l      Last stencil number already used (next starts at last + 1)

Modes:
  (default)       Auto: tab to Stencil → type next value → Enter → repeat
  --with-serial   You type Serial Number; press Enter in this terminal to continue

Options:
  --pad <n>       Zero-pad width (default: ${DEFAULT_PAD} → 022)
  --sep <s>       Between name and number (default: " - ")
  --tabs <n>      Tabs from Serial Number to Stencil (default: ${DEFAULT_TABS_TO_STENCIL})
  --delay <ms>    Pause after each ADD (default: 400)
  --countdown <s> Seconds before first keystroke in auto mode (default: 5)
  --dry-run       Print the plan; no keyboard
  --help, -h      Show this help

Examples:
  /flexac
  /flexac -n "USB Drive" -c 10 -l 40
  /flexac -n "USB Drive" -c 10 -l 40 --with-serial
`);
}

function parseArgs(argv) {
  const args = {
    name: null,
    count: null,
    last: null,
    pad: DEFAULT_PAD,
    separator: DEFAULT_SEP,
    tabs: DEFAULT_TABS_TO_STENCIL,
    delay: 400,
    countdown: 5,
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
      case "--countdown":
        args.countdown = Number(next());
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

async function countdown(seconds, onTick) {
  if (seconds <= 0) return;
  for (let s = seconds; s > 0; s--) {
    onTick?.(s);
    await sleep(1000);
  }
}

async function runSession(args, stencils, rl) {
  const modeLabel = args.withSerial
    ? "with serial (wait for you)"
    : "stencil only (auto)";
  const recent = [];
  let done = 0;

  const base = () => ({
    name: args.name,
    mode: modeLabel,
    total: stencils.length,
    done,
    current: null,
    next: stencils[done] || null,
    phase: "Starting",
    recent: [...recent],
  });

  if (!args.withSerial) {
    await countdown(args.countdown, (s) => {
      showStatus({
        ...base(),
        phase: `Focus Serial Number in Flex — starting in ${s}s`,
      });
    });
  } else {
    showStatus({
      ...base(),
      phase: "Waiting — type Serial in Flex, then press Enter here",
    });
  }

  for (const [i, stencil] of stencils.entries()) {
    const next = stencils[i + 1] || null;

    if (args.withSerial) {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: `Waiting for serial — then Enter here for ${stencil}`,
      });
      await rl.question(
        `${YELLOW}▸${RESET} Serial typed in Flex? Press ${BOLD}Enter${RESET} to fill stencil + ADD… `
      );
    }

    showStatus({
      ...base(),
      current: stencil,
      next,
      phase: `Typing stencil → ADD`,
    });

    try {
      await tabTypeAndEnter(stencil, { tabs: args.tabs });
    } catch (err) {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: `Error: ${err.message}`,
      });
      console.error(
        `${RED}Stopped at ${stencil}.${RESET} On macOS: System Settings → Privacy & Security → Accessibility — allow Terminal/Cursor.`
      );
      process.exit(1);
    }

    done = i + 1;
    recent.push(stencil);
    showStatus({
      ...base(),
      current: stencil,
      next: stencils[done] || null,
      phase: done === stencils.length ? "Done" : "Added — continuing",
      recent: [...recent],
    });

    if (i < stencils.length - 1) {
      await sleep(args.delay);
    }
  }

  saveLastRun({
    name: args.name,
    last: args.last + stencils.length,
    count: args.count,
    withSerial: args.withSerial,
  });

  console.log(
    `${GREEN}${BOLD}Done.${RESET} Added ${stencils.length}. Next last number to use: ${BOLD}${args.last + stencils.length}${RESET}\n`
  );
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
    (args.name == null && args.count == null && args.last == null && !args.dryRun);

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
      console.log(
        `Will fill ${stencils.length} stencils: ${stencils[0]} … ${stencils.at(-1)}`
      );
      for (const [i, stencil] of stencils.entries()) {
        console.log(
          args.withSerial
            ? `${i + 1}. wait for serial → Enter → Tab×${args.tabs} → "${stencil}" → Enter`
            : `${i + 1}. Tab×${args.tabs} → "${stencil}" → Enter`
        );
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
