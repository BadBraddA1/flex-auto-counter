#!/usr/bin/env node

import { buildSerials } from "./serials.js";
import { typeAndEnter, sleep } from "./keyboard.js";

function printHelp() {
  console.log(`
Flex Auto Counter — type incrementing serials into Add Serial Unit, hit Enter, repeat.

Usage:
  flex-auto-counter --name <prefix> --count <n> --last <n> [options]

Required:
  --name, -n     Serial prefix (e.g. CAM → CAM101, CAM102, …)
  --count, -c    How many units to add
  --last, -l     Last number already used (next starts at last + 1)

Options:
  --pad <n>      Zero-pad the number (e.g. --pad 3 → CAM001)
  --sep <s>      Separator between name and number (e.g. --sep - → CAM-101)
  --delay <ms>   Pause between entries (default: 400)
  --countdown <s> Seconds before typing starts (default: 5)
  --dry-run      Print what would be typed; no keyboard
  --help, -h     Show this help

Examples:
  flex-auto-counter --name CAM --count 10 --last 100 --dry-run
  flex-auto-counter -n CAM -c 10 -l 100
  flex-auto-counter -n STG -c 5 -l 42 --pad 3 --sep -

Workflow:
  1. Open Flex → Add Serial Unit (leave "Enter key mapped to ADD" checked)
  2. Click into the Serial Number field
  3. Run this CLI (or run first, then focus during the countdown)
  4. Watch it type serial → Enter → next number until count is done
`);
}

function parseArgs(argv) {
  const args = {
    name: null,
    count: null,
    last: null,
    pad: 0,
    separator: "",
    delay: 400,
    countdown: 5,
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

async function countdown(seconds) {
  if (seconds <= 0) return;
  for (let s = seconds; s > 0; s--) {
    process.stdout.write(`\rFocus Serial Number field… starting in ${s}s   `);
    await sleep(1000);
  }
  process.stdout.write("\rStarting now.                              \n");
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

  let serials;
  try {
    serials = buildSerials({
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

  console.log(`Will add ${serials.length} serials: ${serials[0]} … ${serials.at(-1)}`);

  if (args.dryRun) {
    for (const [i, serial] of serials.entries()) {
      console.log(`${i + 1}. type "${serial}" → Enter`);
    }
    console.log("Dry run complete (nothing typed).");
    return;
  }

  await countdown(args.countdown);

  for (const [i, serial] of serials.entries()) {
    process.stdout.write(`[${i + 1}/${serials.length}] ${serial}\n`);
    try {
      await typeAndEnter(serial);
    } catch (err) {
      console.error(`\nStopped at ${serial}: ${err.message}`);
      console.error(
        "On macOS: System Settings → Privacy & Security → Accessibility — allow Terminal/Cursor."
      );
      process.exit(1);
    }
    if (i < serials.length - 1) {
      await sleep(args.delay);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
