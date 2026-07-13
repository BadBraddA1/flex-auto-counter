#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildCounterValues } from "./serials.js";
import { tabTypeAndEnter, sleep } from "./keyboard.js";

/** Serial → Barcode → RFID → Stencil */
const DEFAULT_TABS_TO_STENCIL = 3;

function printHelp() {
  console.log(`
Flex Auto Counter — auto-fill incrementing Stencil values in Add Serial Unit.

Usage:
  flex-auto-counter --name <prefix> --count <n> --last <n> [options]

Required:
  --name, -n      Stencil prefix (e.g. CAM → CAM101, CAM102, …)
  --count, -c     How many units to add
  --last, -l      Last stencil number already used (next starts at last + 1)

Modes:
  (default)       Auto: tab to Stencil → type next value → Enter → repeat
  --with-serial   Interactive: you type Serial Number, press Enter in this
                  terminal to continue; tool fills Stencil and submits; then
                  waits for Serial again (rinse / repeat)

Options:
  --pad <n>       Zero-pad the number (e.g. --pad 3 → CAM001)
  --sep <s>       Separator between name and number (e.g. --sep - → CAM-101)
  --tabs <n>      Tabs from Serial Number to Stencil (default: ${DEFAULT_TABS_TO_STENCIL})
                  Use --tabs 0 if you click Stencil yourself before each continue
  --delay <ms>    Pause after each ADD (default: 400)
  --countdown <s> Seconds before first keystroke in auto mode (default: 5)
  --dry-run       Print the plan; no keyboard
  --help, -h      Show this help

Examples:
  # Most common: stencil only, auto submit
  flex-auto-counter -n CAM -c 10 -l 100
  flex-auto-counter -n CAM -c 10 -l 100 --dry-run

  # Operator types each serial, then continues for stencil + ADD
  flex-auto-counter -n CAM -c 10 -l 100 --with-serial

Workflow (stencil only):
  1. Open Flex → Add Serial Unit (leave "Enter key mapped to ADD" checked)
  2. Click Serial Number (tool will Tab ${DEFAULT_TABS_TO_STENCIL}× to Stencil)
  3. Run the CLI — it types stencil → Enter → next stencil until done

Workflow (--with-serial):
  1. Same popup; click Serial Number
  2. Run with --with-serial
  3. Type the serial in Flex
  4. Press Enter in this terminal → tool Tabs to Stencil, types next stencil, ADD
  5. Modal stays open → type next serial → Enter here → repeat
`);
}

function parseArgs(argv) {
  const args = {
    name: null,
    count: null,
    last: null,
    pad: 0,
    separator: "",
    tabs: DEFAULT_TABS_TO_STENCIL,
    delay: 400,
    countdown: 5,
    withSerial: false,
    dryRun: false,
    help: false,
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

async function countdown(seconds, message) {
  if (seconds <= 0) return;
  for (let s = seconds; s > 0; s--) {
    process.stdout.write(`\r${message} starting in ${s}s   `);
    await sleep(1000);
  }
  process.stdout.write("\rStarting now.                                    \n");
}

async function waitForContinue(rl, index, total, stencil) {
  await rl.question(
    `[${index}/${total}] Type Serial in Flex, then press Enter here for stencil ${stencil}… `
  );
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(1);
  }

  if (args.help || process.argv.length <= 2) {
    printHelp();
    process.exit(0);
  }

  if (args.name == null || args.count == null || args.last == null) {
    console.error("Missing required flags: --name, --count, --last");
    printHelp();
    process.exit(1);
  }

  if (!Number.isInteger(args.tabs) || args.tabs < 0) {
    console.error("--tabs must be a non-negative integer");
    process.exit(1);
  }

  let stencils;
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

  const mode = args.withSerial ? "with-serial (wait for OP)" : "stencil-only (auto)";
  console.log(
    `Mode: ${mode}\nWill fill ${stencils.length} stencils: ${stencils[0]} … ${stencils.at(-1)} (tabs→Stencil: ${args.tabs})`
  );

  if (args.dryRun) {
    for (const [i, stencil] of stencils.entries()) {
      if (args.withSerial) {
        console.log(
          `${i + 1}. wait for OP serial → Enter in CLI → Tab×${args.tabs} → type "${stencil}" → Enter`
        );
      } else {
        console.log(
          `${i + 1}. Tab×${args.tabs} → type "${stencil}" → Enter`
        );
      }
    }
    console.log("Dry run complete (nothing typed).");
    return;
  }

  const rl = args.withSerial
    ? readline.createInterface({ input, output })
    : null;

  try {
    if (!args.withSerial) {
      await countdown(
        args.countdown,
        "Focus Serial Number (or leave it focused)…"
      );
    } else {
      console.log(
        "Ready. For each unit: type Serial in Flex, then press Enter in this terminal."
      );
    }

    for (const [i, stencil] of stencils.entries()) {
      if (args.withSerial) {
        await waitForContinue(rl, i + 1, stencils.length, stencil);
      } else {
        process.stdout.write(`[${i + 1}/${stencils.length}] stencil ${stencil}\n`);
      }

      try {
        await tabTypeAndEnter(stencil, { tabs: args.tabs });
      } catch (err) {
        console.error(`\nStopped at ${stencil}: ${err.message}`);
        console.error(
          "On macOS: System Settings → Privacy & Security → Accessibility — allow Terminal/Cursor."
        );
        process.exit(1);
      }

      if (i < stencils.length - 1) {
        await sleep(args.delay);
      }
    }

    console.log("Done.");
  } finally {
    rl?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
