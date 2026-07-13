# Flex Auto Counter (`/flexac`)

CLI that fills Flex’s **Add Serial Unit** popup. It writes incrementing **Stencil** values (same format as your inventory list), presses Enter (ADD), and can run a whole batch with one start.

## Stencil format

Matches Flex lists:

```text
USB Drive - 022
USB Drive - 023
USB Drive - 040
```

Defaults: separator ` - `, zero-pad **3**, **Tab×4** from the top of the form to Stencil, browser **Zen**.

## Install

```bash
git clone https://github.com/BadBraddA1/flex-auto-counter.git ~/flex-auto-counter
~/flex-auto-counter/bin/install-shell.sh
# open a new terminal tab, then:
/flexac --help
```

On macOS: **System Settings → Privacy & Security → Accessibility** — allow **Terminal** (and Cursor/iTerm if you use those).

## Quick start

```bash
# Guided walkthrough (remembers last name / last number / tabs / app)
/flexac

# Or flags
/flexac -n "USB Drive" -c 10 -l 41 --app Zen
```

### If values land in the wrong field

```bash
/flexac --calibrate --app Zen
```

Open **Add Serial Unit**, then answer **y** when **Stencil** is focused. The Tab count is saved under `~/.config/flex-auto-counter/`.

## Workflows

### Stencil only (most jobs — no serial)

```bash
/flexac -n "USB Drive" -c 10 -l 41 --app Zen
```

1. Open **Add Serial Unit** (leave **Enter key mapped to ADD** checked).
2. Press **Enter once** in the terminal.
3. **First item:** activate Zen → **Tab×4** → Stencil → paste → ADD.  
4. **Rest of the batch:** paste → ADD only (**no Tabbing**).  
5. Leave Flex alone until it finishes. Confirm whether to save the next “last number”.

### With serial (operator types Serial each unit)

```bash
/flexac -n "USB Drive" -c 10 -l 41 --app Zen --with-serial
```

1. Open **Add Serial Unit**, type **Serial Number** at the top.
2. Press **Enter** in the terminal.
3. We **Tab×4** → Stencil → paste → ADD.
4. Repeat for each unit (Tabs every time, because you’re back on Serial after typing).

## CLI flags

| Flag | Meaning |
|------|---------|
| `--name` / `-n` | Stencil name (`"USB Drive"` → `USB Drive - 042`) |
| `--count` / `-c` | How many to add |
| `--last` / `-l` | Last number already used (next is `last + 1`) |
| `--app` | Browser process/app name (e.g. `Zen`) |
| `--tabs` | Tabs from top → Stencil (default **4**, or last calibrated) |
| `--with-serial` | Pause for Serial each unit; Tab every item |
| `--calibrate` | Interactively learn Tab count to Stencil |
| `--delay` | ms after each ADD (default `900`) |
| `--refocus-delay` | ms after activating the browser (default `700`) |
| `--no-refocus` | Don’t activate the browser |
| `--pad` | Zero-pad width (default `3`) |
| `--sep` | Between name and number (default `" - "`) |
| `--dry-run` | Print the plan; no keyboard |
| `--help` / `-h` | Help |

Quote names with spaces: `-n "USB Drive"`.

```bash
/flexac -n "USB Drive" -c 10 -l 41 --app Zen --dry-run
/flexac --calibrate --app Zen
```

## How it works (macOS)

1. Builds stencils: `name + " - " + padded(last+1)` … for `count` items.
2. Activates your browser by **name** (not Cmd+Tab — that was unreliable).
3. Tabs slowly (one keystroke at a time), **Cmd+A**, pastes via clipboard, presses Enter.
4. **Stencil-only:** Tab only on the first item; later items paste into Stencil again.
5. **With-serial:** Tab on every item after you type Serial.
6. Remembers last run in `~/.config/flex-auto-counter/last-run.json`.

Live typing is **macOS-only**. `--dry-run` and the counter math work on any Node 18+.

## Practice form (optional)

```bash
cd ~/flex-auto-counter
npm run test-form          # http://localhost:8765
# other terminal:
/flexac -n "USB Drive" -c 3 -l 40 --app Zen --dry-run
npm test
npm run demo
```

## Repo

https://github.com/BadBraddA1/flex-auto-counter
