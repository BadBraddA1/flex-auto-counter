# Flex Auto Counter

CLI for Flex’s **Add Serial Unit** popup. It auto-fills the **Stencil** field to match your inventory lists, hits Enter (ADD), and repeats.

Stencil format (same as Flex):

```text
USB Drive - 022
USB Drive - 023
USB Drive - 040
```

Defaults: separator ` - `, zero-pad width `3`. Serial Number is usually left empty. If you need a serial on each unit, use `--with-serial`.

Working title — rename anytime.

## Terminal command: `/flexac`

```bash
/flexac
# or
/flexac -n "USB Drive" -c 5 -l 41 --app Zen
```

### Workflow

**First time — calibrate Tabs** (fixes wrong field / RFID / Location):

```bash
/flexac --calibrate --app Zen
```

Open Add Serial Unit, then answer yes when Stencil is focused. That Tab count is saved.

**Stencil only (no serial)** — one Enter, then auto:

```bash
/flexac -n "USB Drive" -c 10 -l 41 --app Zen
```

1. Open **Add Serial Unit**  
2. Press **Enter once** in the terminal  
3. We Tab → paste → ADD → wait → repeat for the whole batch  

**With serial** — Enter each unit after you type the serial:

```bash
/flexac -n "USB Drive" -c 10 -l 41 --app Zen --with-serial
```

Open a **new** terminal tab after install so `.zshenv` picks up the functions. Or run `source ~/.zshenv`.

### Install on another Mac

```bash
git clone https://github.com/BadBraddA1/flex-auto-counter.git ~/flex-auto-counter
~/flex-auto-counter/bin/install-shell.sh
# new tab, then:
/flexac --help
```

Override checkout path with `FLEX_AUTO_COUNTER_HOME` if you keep the repo elsewhere (home wrapper only).

## Quick start

```bash
cd flex-auto-counter
npm test
npm run demo
```

### Practice form

```bash
# Terminal 1
npm run test-form
# → http://localhost:8765

# Terminal 2 — stencil only (click Serial Number first)
node src/cli.js -n "USB Drive" -c 5 -l 40 --countdown 3

# Or with operator-entered serials
node src/cli.js -n "USB Drive" -c 5 -l 40 --with-serial
```

### Real Flex

1. Open **Add Serial Unit**; leave **Enter key mapped to ADD button** checked.
2. Click **Serial Number**.
3. Run one of:

```bash
# Most common — auto stencil counter (→ USB Drive - 041 …)
/flexac -n "USB Drive" -c 10 -l 40

# When each unit needs a serial you type by hand
/flexac -n "USB Drive" -c 10 -l 40 --with-serial
```

On macOS: System Settings → Privacy & Security → Accessibility — allow Terminal/Cursor.

## Modes

### Stencil only (default)

1. Open **Add Serial Unit** (cursor at top).
2. Press Enter here → we activate browser, Tab×3 → Stencil, paste, ADD.
3. Flex returns to the top — open Add Serial Unit again for the next unit.

### With serial (`--with-serial`)

1. Open **Add Serial Unit**, type **Serial Number** at the top.
2. Press Enter here → Tab×3 → Stencil → paste → ADD.
3. Repeat for the next unit.

## CLI

| Flag | Meaning |
|------|---------|
| `--name` / `-n` | Stencil name (`"USB Drive"` → `USB Drive - 041`) |
| `--count` / `-c` | How many to add |
| `--last` / `-l` | Last stencil number already used (next is `last + 1`) |
| `--with-serial` | You type Serial at the top first each time |
| `--app` | Browser app name (e.g. `Zen`) |
| `--tabs` | Tabs from top → Stencil (default `3`) |
| `--pad` | Zero-pad width (default `3` → `022`) |
| `--sep` | Separator (default `" - "`) |
| `--delay` | ms after each ADD (default `500`) |
| `--dry-run` | Print the plan only |

```bash
/flexac -n "USB Drive" -c 10 -l 40 --dry-run
/flexac -n "USB Drive" -c 10 -l 40 --with-serial --dry-run
```

Quote the name when it has spaces: `-n "USB Drive"`.

## How it works

1. Builds stencil list: `name + " - " + padded(last+1)` … through `count` items.
2. **Auto:** countdown → Tab to Stencil → type → Enter → delay → repeat.
3. **With serial:** prompt → you fill Serial → Enter in CLI → Tab → type stencil → Enter → prompt again.
4. Flex keeps the modal open after ADD (same as the practice form).

Live keyboard typing is **macOS-only** for now. `--dry-run` and the counter math work on any Node 18+.

## Share / install

```bash
git clone https://github.com/BadBraddA1/flex-auto-counter.git
cd flex-auto-counter
./bin/install-shell.sh
```

## Tests

```bash
npm test          # counter value generation (includes USB Drive - 022 style)
npm run demo      # dry-run sample
npm run test-form # local HTML stand-in for the Flex modal
```
