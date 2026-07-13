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
import { detectFlexApps } from "./keyboard.js";

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

async function askFlexApp(rl, savedApp) {
  let detected = [];
  try {
    detected = await detectFlexApps();
  } catch {
    detected = [];
  }

  console.log(`
${BOLD}Which app is Flex in?${RESET}  ${DIM}(we activate this by name — Cmd+Tab is unreliable)${RESET}
`);

  const choices = [];
  if (savedApp) choices.push(savedApp);
  for (const name of detected) {
    if (!choices.some((c) => c.toLowerCase() === name.toLowerCase())) {
      choices.push(name);
    }
  }
  // Always offer common browsers even if not detected yet
  for (const name of ["Google Chrome", "Safari", "Arc", "Microsoft Edge", "Firefox"]) {
    if (!choices.some((c) => c.toLowerCase() === name.toLowerCase())) {
      choices.push(name);
    }
  }

  choices.forEach((name, i) => {
    const mark = detected.some((d) => d.toLowerCase() === name.toLowerCase())
      ? ` ${DIM}(running)${RESET}`
      : "";
    console.log(`  ${CYAN}${i + 1}${RESET}) ${name}${mark}`);
  });
  console.log(`  ${CYAN}${choices.length + 1}${RESET}) Type a custom app name`);

  const defaultIdx = "1";
  const pick = await ask(rl, `Choose 1–${choices.length + 1}`, {
    defaultValue: defaultIdx,
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > choices.length + 1) {
        return `Enter 1–${choices.length + 1}`;
      }
      return null;
    },
  });

  const n = Number(pick);
  if (n === choices.length + 1) {
    return ask(rl, "App name exactly as in the menu bar", {
      defaultValue: savedApp || "Google Chrome",
    });
  }
  return choices[n - 1];
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
  const focusDefault =
    defaults.tabs === 0
      ? "1"
      : saved.tabs === 0
        ? "1"
        : defaults.tabs != null
          ? "2"
          : "1";

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
  ${CYAN}1${RESET}) Stencil only — fill Stencil + ADD (most jobs)
  ${CYAN}2${RESET}) With serial — you type Serial, Enter here to continue
`);
  const modeRaw = await ask(rl, "Choose mode 1 or 2", {
    defaultValue: modeDefault,
    validate: (v) => (v === "1" || v === "2" ? null : "Enter 1 or 2"),
  });

  console.log(`
${BOLD}Where should the cursor be in Flex?${RESET}
  ${CYAN}1${RESET}) ${BOLD}Stencil field${RESET}  ← recommended (no Tabbing)
  ${CYAN}2${RESET}) Serial Number field (tool Tabs ×3 to Stencil)
`);
  const focusRaw = await ask(rl, "Choose focus 1 or 2", {
    defaultValue: focusDefault,
    validate: (v) => (v === "1" || v === "2" ? null : "Enter 1 or 2"),
  });

  const flexApp =
    defaults.flexApp ||
    (await askFlexApp(rl, saved.flexApp || defaults.flexApp));

  const last = Number(lastRaw);
  const count = Number(countRaw);
  const withSerial = modeRaw === "2";
  const tabs = focusRaw === "1" ? 0 : 3;
  const pad = defaults.pad ?? 3;
  const separator = defaults.separator ?? " - ";
  const delay = defaults.delay ?? 500;
  const refocusDelayMs = defaults.refocusDelayMs ?? 600;

  const stencils = buildCounterValues({ name, count, last, pad, separator });

  console.log(`
${BOLD}${GREEN}Plan${RESET}
  First:   ${stencils[0]}
  Last:    ${stencils.at(-1)}
  Total:   ${stencils.length}
  Mode:    ${withSerial ? "with serial" : "stencil only"}
  Focus:   ${tabs === 0 ? "Stencil (paste, no Tab)" : "Serial → Tab×3 → Stencil"}
  Browser: ${flexApp}
`);

  printPrepChecklist(withSerial, tabs === 0, flexApp);

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
    refocusDelayMs,
    flexApp,
    refocus: true,
    withSerial,
    dryRun: false,
    help: false,
    stencils,
    wizard: true,
  };
}
