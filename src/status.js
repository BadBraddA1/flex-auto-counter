/** Simple terminal status UI for the Flex Auto Counter run. */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function bar(done, total, width = 24) {
  if (total <= 0) return "[" + " ".repeat(width) + "]";
  const filled = Math.round((done / total) * width);
  return (
    "[" +
    "█".repeat(Math.max(0, filled)) +
    "░".repeat(Math.max(0, width - filled)) +
    "]"
  );
}

function line(label, value) {
  return `  ${DIM}${label.padEnd(12)}${RESET}${value}`;
}

/**
 * @param {object} s
 * @param {string} s.name
 * @param {string} s.mode
 * @param {number} s.total
 * @param {number} s.done
 * @param {string|null} s.current
 * @param {string|null} s.next
 * @param {string} s.phase
 * @param {string[]} [s.recent]
 */
export function renderStatus(s) {
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const recent = (s.recent || []).slice(-5);
  const recentBlock =
    recent.length === 0
      ? `  ${DIM}(none yet)${RESET}`
      : recent.map((r) => `  ${GREEN}✓${RESET} ${r}`).join("\n");

  const phaseColor =
    s.phase.startsWith("Waiting") || s.phase.startsWith("Focus")
      ? YELLOW
      : s.phase.startsWith("Error")
        ? RED
        : s.phase === "Done"
          ? GREEN
          : CYAN;

  return [
    "",
    `${BOLD}${CYAN}┌─ Flex Auto Counter ─────────────────────────${RESET}`,
    line("Name", s.name),
    line("Mode", s.mode),
    line("Progress", `${bar(s.done, s.total)} ${s.done}/${s.total} (${pct}%)`),
    line("Current", s.current || "—"),
    line("Next", s.next || "—"),
    line("Status", `${phaseColor}${s.phase}${RESET}`),
    `${BOLD}${CYAN}├─ Recent ────────────────────────────────────${RESET}`,
    recentBlock,
    `${BOLD}${CYAN}└─────────────────────────────────────────────${RESET}`,
    "",
  ].join("\n");
}

export function printBanner() {
  console.log(`
${BOLD}${CYAN}╔══════════════════════════════════════════════╗
║          Flex Auto Counter  /flexac          ║
║     Walkthrough → status → stencil ADD       ║
╚══════════════════════════════════════════════╝${RESET}
`);
}

export function printPrepChecklist(withSerial, stencilDirect = true, flexApp = "your browser") {
  console.log(`${BOLD}Before we start${RESET}`);
  console.log(`  1. Open Flex in ${BOLD}${flexApp}${RESET} → Add Serial Unit`);
  console.log(`  2. Leave ${BOLD}Enter key mapped to ADD${RESET} checked`);
  if (withSerial) {
    console.log(`  3. Click ${BOLD}Serial Number${RESET}, type the serial`);
    if (stencilDirect) {
      console.log(`  4. Click ${BOLD}Stencil${RESET}, then press Enter ${BOLD}here${RESET}`);
    } else {
      console.log(
        `  4. Leave focus on Serial, then press Enter ${BOLD}here${RESET}`
      );
    }
  } else if (stencilDirect) {
    console.log(`  3. Click into the ${BOLD}Stencil${RESET} field`);
    console.log(
      `  4. Press Enter ${BOLD}here${RESET} — we activate ${flexApp} and paste`
    );
  } else {
    console.log(`  3. Click ${BOLD}Serial Number${RESET}`);
    console.log(
      `  4. Press Enter ${BOLD}here${RESET} — we activate ${flexApp}, Tab to Stencil, paste`
    );
  }
  console.log("");
}

export { RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED };
