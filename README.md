# Flex Auto Counter

CLI for Flex’s **Add Serial Unit** popup. It auto-fills the **Stencil** field with incrementing values (`name` + count from `last`), hits Enter (ADD), and repeats.

Serial Number is usually left alone. If you need a serial on each unit, use `--with-serial`: you type the serial, press Enter in the terminal to continue, the tool fills Stencil + submits, then waits again.

Working title — rename anytime.

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
node src/cli.js -n CAM -c 5 -l 100 --countdown 3

# Or with operator-entered serials
node src/cli.js -n CAM -c 5 -l 100 --with-serial
```

### Real Flex

1. Open **Add Serial Unit**; leave **Enter key mapped to ADD button** checked.
2. Click **Serial Number**.
3. Run one of:

```bash
# Most common — auto stencil counter
node src/cli.js --name CAM --count 10 --last 100

# When each unit needs a serial you type by hand
node src/cli.js --name CAM --count 10 --last 100 --with-serial
```

On macOS: System Settings → Privacy & Security → Accessibility — allow Terminal/Cursor.

## Modes

### Stencil only (default)

1. Focus starts on Serial Number.
2. Tool Tabs ×3 → Stencil (Barcode → RFID → Stencil).
3. Types next stencil → Enter (ADD).
4. Modal stays open; focus back on Serial → repeat until count is done.

### With serial (`--with-serial`)

1. You type the **Serial Number** in Flex.
2. Press **Enter in the CLI** (not in Flex) to continue.
3. Tool Tabs to Stencil, types the next stencil, submits.
4. Waits for you to type the next serial — rinse and repeat.

If you click Stencil yourself after entering the serial, use `--tabs 0`.

## CLI

| Flag | Meaning |
|------|---------|
| `--name` / `-n` | Stencil prefix (`CAM` → `CAM101`) |
| `--count` / `-c` | How many to add |
| `--last` / `-l` | Last stencil number already used (next is `last + 1`) |
| `--with-serial` | Wait for OP serial, then continue on Enter in the terminal |
| `--tabs` | Tabs from Serial → Stencil (default `3`; use `0` if you focus Stencil) |
| `--pad` | Zero-pad width (`--pad 3` → `CAM001`) |
| `--sep` | Separator (`--sep -` → `CAM-101`) |
| `--delay` | ms after each ADD (default `400`) |
| `--countdown` | seconds before first keystroke in auto mode (default `5`) |
| `--dry-run` | Print the plan only |

```bash
node src/cli.js -n CAM -c 10 -l 100 --dry-run
node src/cli.js -n CAM -c 10 -l 100 --with-serial --dry-run
```

## How it works

1. Builds stencil list: `name + (last+1)` … `name + (last+count)`.
2. **Auto:** countdown → Tab to Stencil → type → Enter → delay → repeat.
3. **With serial:** prompt → you fill Serial → Enter in CLI → Tab → type stencil → Enter → prompt again.
4. Flex keeps the modal open after ADD (same as the practice form).

Live keyboard typing is **macOS-only** for now. `--dry-run` and the counter math work on any Node 18+.

## Share / install

```bash
git clone https://github.com/BadBraddA1/flex-auto-counter.git
cd flex-auto-counter
npm link   # optional: puts `flex-auto-counter` on your PATH
```

## Tests

```bash
npm test          # counter value generation
npm run demo      # dry-run sample (stencil plan)
npm run test-form # local HTML stand-in for the Flex modal
```
