import {
  activateApp,
  pressTab,
  sleep,
  getFrontmostApp,
  looksLikeTerminalApp,
} from "./keyboard.js";
import { saveLastRun, loadLastRun } from "./state.js";
import { BOLD, CYAN, GREEN, YELLOW, RED, RESET, DIM } from "./status.js";

/**
 * Interactive: open Add Serial Unit, then Tab one-by-one until Stencil is focused.
 * Saves the tab count for later runs.
 */
export async function runCalibrate(rl, { flexApp, tabDelayMs = 220 } = {}) {
  const saved = loadLastRun();
  const app = flexApp || saved.flexApp || "Zen";

  console.log(`
${BOLD}${CYAN}Tab calibration${RESET}
  1. In ${BOLD}${app}${RESET}, click ${BOLD}Add Serial Unit${RESET}
     (cursor should be at the top / Serial Number)
  2. Come back here and press Enter
  3. We activate ${app}, then Tab one field at a time
  4. When ${BOLD}Stencil${RESET} is focused, type ${BOLD}y${RESET}
`);

  await rl.question(`${YELLOW}▸${RESET} Add Serial Unit open? Press ${BOLD}Enter${RESET}… `);

  process.stdout.write(`${YELLOW}→${RESET} Activating ${app}…\n`);
  await activateApp(app);
  await sleep(700);
  const front = await getFrontmostApp();
  if (looksLikeTerminalApp(front)) {
    throw new Error(`Still on “${front}”. Enable Accessibility for Terminal, then retry.`);
  }

  let tabs = 0;
  console.log(`
${DIM}Starting at the top (0 Tabs). After each Tab, answer whether Stencil is focused.${RESET}
`);

  while (tabs < 20) {
    const ans = (
      await rl.question(
        `${CYAN}?${RESET} Tabs so far: ${BOLD}${tabs}${RESET}. Is ${BOLD}Stencil${RESET} focused? (y/n) [n]: `
      )
    )
      .trim()
      .toLowerCase();

    if (ans === "y" || ans === "yes") {
      saveLastRun({ ...saved, flexApp: app, tabs });
      console.log(`
${GREEN}${BOLD}Saved.${RESET} Use Tab×${BOLD}${tabs}${RESET} from the top to reach Stencil.
Next run: ${DIM}/flexac --app ${app}${RESET} (tabs remembered)
`);
      return tabs;
    }

    if (ans === "q" || ans === "quit") {
      console.log("Calibration cancelled.");
      return null;
    }

    process.stdout.write(`${YELLOW}→${RESET} Tab…\n`);
    await activateApp(app);
    await sleep(200);
    await pressTab(1, { delayMs: tabDelayMs });
    tabs += 1;
  }

  console.error(`${RED}Gave up after 20 Tabs. Try again from a fresh Add Serial Unit.${RESET}`);
  return null;
}
