#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildCounterValues } from "./serials.js";
import { fillStencilAndSubmit, sleep } from "./keyboard.js";
import { runWizard } from "./wizard.js";
import { renderStatus, BOLD, GREEN, YELLOW, RED, RESET } from "./status.js";
import { saveLastRun } from "./state.js";

/** Matches Flex inventory stencils like "USB Drive - 022" */
const DEFAULT_PAD = 3;
const DEFAULT_SEP = " - ";
/** Prefer Stencil-direct (0 tabs) — Tabbing often jumps browser/app chrome */
const DEFAULT_TABS = 0;

function printHelp() {
  console.log(`
Flex Auto Counter — auto-fill incrementing Stencil values in Add Serial Unit.

Stencil format:  "USB Drive - 022"

Usage:
  /flexac                         Interactive walkthrough + live status
  /flexac --name <n> --count <n> --last <n> [options]

How typing works (important):
  1. Click the Stencil field in Flex
  2. Press Enter in this terminal
  3. We Cmd+Tab back to Flex, paste the stencil, press Enter (ADD)
  This avoids Tab keystrokes landing in Terminal or switching browser tabs.

Required (flag mode):
  --name, -n      Stencil name (e.g. "USB Drive")
  --count, -c     How many units to add
  --last, -l      Last stencil number already used

Modes:
  (default)       Stencil only
  --with-serial   You type Serial; Enter here to paste stencil + ADD

Options:
  --tabs <n>      Tabs before paste (default: ${DEFAULT_TABS} = click Stencil yourself)
                  Use --tabs 3 to start on Serial Number instead
  --no-refocus    Skip Cmd+Tab back to Flex (only if Flex is already frontmost)
  --pad <n>       Zero-pad width (default: ${DEFAULT_PAD})
  --sep <s>       Separator (default: " - ")
  --delay <ms>    Pause after each ADD (default: 500)
  --refocus-delay <ms>  Wait after Cmd+Tab (default: 550)
  --dry-run       Print the plan; no keyboard
  --help, -h      Show this help

Examples:
  /flexac
  /flexac -n "USB Drive" -c 10 -l 40
  /flexac -n "USB Drive" -c 10 -l 40 --tabs 3
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
    refocusDelayMs: 550,
    refocus: true,
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
        // kept for compat; ignored — we use Enter-to-start now
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

async function runSession(args, stencils, rl) {
  const modeLabel = args.withSerial
    ? "with serial (wait for you)"
    : "stencil only";
  const focusHint =
    args.tabs === 0 ? "click Stencil in Flex" : "click Serial (Tab×" + args.tabs + ")";
  const recent = [];
  let done = 0;

  const base = () => ({
    name: args.name,
    mode: `${modeLabel} · ${focusHint}`,
    total: stencils.length,
    done,
    current: null,
    next: stencils[done] || null,
    phase: "Starting",
    recent: [...recent],
  });

  for (const [i, stencil] of stencils.entries()) {
    const next = stencils[i + 1] || null;

    if (args.withSerial) {
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase: `Type Serial in Flex${args.tabs === 0 ? ", click Stencil" : ""}, then Enter here`,
      });
      await rl.question(
        `${YELLOW}▸${RESET} Serial ready? Press ${BOLD}Enter${RESET} to paste ${BOLD}${stencil}${RESET} + ADD… `
      );
    } else {
      // Wait before each unit so Cmd+Tab can return to Flex after Terminal focus
      showStatus({
        ...base(),
        current: stencil,
        next,
        phase:
          args.tabs === 0
            ? "Click Stencil in Flex, then press Enter here"
            : "Click Serial in Flex, then press Enter here",
      });
      await rl.question(
        `${YELLOW}▸${RESET} Flex ready (${focusHint})? Press ${BOLD}Enter${RESET} for ${BOLD}${stencil}${RESET}… `
      );
    }

    // Don't clear the screen right before keystrokes — keep Terminal quiet
    process.stdout.write(
      `${YELLOW}→${RESET} Switching to Flex, pasting ${BOLD}${stencil}${RESET}…\n`
    );

    try {
      await fillStencilAndSubmit(stencil, {
        tabs: args.tabs,
        // Always refocus after Enter in this terminal (Terminal became frontmost)
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
      console.error(
        "Tip: click Stencil in Flex, run again. Accessibility: System Settings → Privacy & Security → Accessibility."
      );
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
      phase: done === stencils.length ? "Done" : "Added — ready for next",
      recent: [...recent],
    });

    if (i < stencils.length - 1) {
      await sleep(args.delay);
    }
  }

  const confirm = await rl.question(
    `${GREEN}▸${RESET} Did Flex look correct? Save last number as ${BOLD}${args.last + stencils.length}${RESET}? (y/n) [y]: `
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
    });
    console.log(
      `${GREEN}${BOLD}Saved.${RESET} Next time use last number: ${BOLD}${args.last + stencils.length}${RESET}\n`
    );
  } else {
    console.log(
      `${YELLOW}Not saved.${RESET} Keep using last number: ${BOLD}${args.last}${RESET}\n`
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
      console.log(
        `Will fill ${stencils.length} stencils: ${stencils[0]} … ${stencils.at(-1)}`
      );
      for (const [i, stencil] of stencils.entries()) {
        const steps = [
          "Enter here",
          args.refocus !== false ? "Cmd+Tab→Flex" : null,
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
