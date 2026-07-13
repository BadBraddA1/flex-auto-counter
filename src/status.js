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

export function printPrepChecklist(withSerial, flexApp = "your browser", tabs = 3) {
  console.log(`${BOLD}How it runs${RESET}`);
  console.log(`  1. In ${BOLD}${flexApp}${RESET}, click ${BOLD}Add Serial Unit${RESET}`);
  console.log(`  2. Leave ${BOLD}Enter key mapped to ADD${RESET} checked`);
  if (withSerial) {
    console.log(`  3. Type ${BOLD}Serial${RESET} at the top, press Enter ${BOLD}here${RESET} each unit`);
    console.log(`  4. We Tab×${tabs} → Stencil → paste → ADD`);
  } else {
    console.log(`  3. Press Enter ${BOLD}here once${RESET} — we auto-run the whole batch`);
    console.log(`  4. Each item: Tab×${tabs} → Stencil → paste → ADD → wait for top reset`);
  }
  console.log(`
${DIM}Wrong field (RFID / Location)? Run: /flexac --calibrate --app ${flexApp}${RESET}
`);
}

export { RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED };
