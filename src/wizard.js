import {
  printBanner,
  printPrepChecklist,
  BOLD,
  DIM,
  CYAN,
  GREEN,
  YELLOW,
  RESET,
} from "./status.js";
import { loadLastRun } from "./state.js";
import { buildCounterValues } from "./serials.js";

async function ask(rl, label, { defaultValue, validate } = {}) {
  const hint =
    defaultValue !== undefined && String(defaultValue) !== ""
      ? ` ${DIM}[${defaultValue}]${RESET}`
      : "";
  while (true) {
    const raw = (await rl.question(`${CYAN}?${RESET} ${label}${hint}: `)).trim();
    const value = raw === "" ? defaultValue : raw;
    if (value === undefined || value === "") {
      console.log(`  ${YELLOW}Please enter a value.${RESET}`);
      continue;
    }
    if (validate) {
      const err = validate(value);
      if (err) {
        console.log(`  ${YELLOW}${err}${RESET}`);
        continue;
      }
    }
    return value;
  }
}

function parseIntStrict(value, label) {
  if (!/^\d+$/.test(String(value))) return `${label} must be a whole number`;
  return null;
}

/**
 * Interactive walkthrough. Returns a full args object ready to run.
 */
export async function runWizard(rl, defaults = {}) {
  printBanner();

  const saved = loadLastRun();
  const nameDefault = defaults.name ?? saved.name ?? "USB Drive";
  const lastDefault =
    defaults.last != null
      ? String(defaults.last)
      : saved.last != null
        ? String(saved.last)
        : "0";
  const countDefault =
    defaults.count != null
      ? String(defaults.count)
      : saved.count != null
        ? String(saved.count)
        : "10";
  const modeDefault = defaults.withSerial ? "2" : saved.withSerial ? "2" : "1";

  console.log(
    `${BOLD}Setup${RESET}  ${DIM}(Enter keeps the value in [brackets])${RESET}\n`
  );

  const name = await ask(rl, "Stencil name", { defaultValue: nameDefault });
  const lastRaw = await ask(rl, "Last number already used", {
    defaultValue: lastDefault,
    validate: (v) => parseIntStrict(v, "Last number"),
  });
  const countRaw = await ask(rl, "How many to add", {
    defaultValue: countDefault,
    validate: (v) => {
      const err = parseIntStrict(v, "Count");
      if (err) return err;
      if (Number(v) < 1) return "Count must be at least 1";
      return null;
    },
  });

  console.log(`
${BOLD}Mode${RESET}
  ${CYAN}1${RESET}) Stencil only — auto type + Enter (most jobs)
  ${CYAN}2${RESET}) With serial — you type Serial, Enter here to continue
`);
  const modeRaw = await ask(rl, "Choose mode 1 or 2", {
    defaultValue: modeDefault,
    validate: (v) => (v === "1" || v === "2" ? null : "Enter 1 or 2"),
  });

  const last = Number(lastRaw);
  const count = Number(countRaw);
  const withSerial = modeRaw === "2";
  const pad = defaults.pad ?? 3;
  const separator = defaults.separator ?? " - ";
  const tabs = defaults.tabs ?? 3;
  const delay = defaults.delay ?? 400;
  const countdown = defaults.countdown ?? 5;

  const stencils = buildCounterValues({ name, count, last, pad, separator });

  console.log(`
${BOLD}${GREEN}Plan${RESET}
  First:  ${stencils[0]}
  Last:   ${stencils.at(-1)}
  Total:  ${stencils.length}
  Mode:   ${withSerial ? "with serial (wait for you)" : "stencil only (auto)"}
`);

  printPrepChecklist(withSerial);

  const go = await ask(rl, "Ready to run? (y/n)", {
    defaultValue: "y",
    validate: (v) =>
      ["y", "yes", "n", "no"].includes(v.toLowerCase())
        ? null
        : "Enter y or n",
  });

  if (!["y", "yes"].includes(go.toLowerCase())) {
    console.log("Cancelled.");
    process.exit(0);
  }

  return {
    name,
    count,
    last,
    pad,
    separator,
    tabs,
    delay,
    countdown,
    withSerial,
    dryRun: false,
    help: false,
    stencils,
    wizard: true,
  };
}
