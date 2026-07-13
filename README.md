# Flex Auto Counter

Little CLI for Flex’s **Add Serial Unit** popup: give it a name prefix, how many units to add, and the last number you already used. It types the next serial into the focused field, hits Enter (ADD), then keeps going until the count is done.

Name is a working title — rename anytime.

## Quick start

```bash
cd flex-auto-counter
npm test
npm run demo
```

### Practice on a fake Flex form (recommended first)

```bash
# Terminal 1 — open the practice form
npm run test-form
# → http://localhost:8765

# Terminal 2 — after clicking Serial Number in the browser
node src/cli.js -n CAM -c 5 -l 100 --countdown 3
```

You should see `CAM101` … `CAM105` land in the log, same flow as real Flex (popup stays open, Enter = ADD).

### Against real Flex

1. Open **Add Serial Unit** and leave **Enter key mapped to ADD button** checked.
2. Click into **Serial Number**.
3. Run:

```bash
node src/cli.js --name CAM --count 10 --last 100
```

On macOS, grant **Accessibility** to Terminal (or Cursor/iTerm):  
System Settings → Privacy & Security → Accessibility.

## CLI

| Flag | Meaning |
|------|---------|
| `--name` / `-n` | Prefix (`CAM` → `CAM101`) |
| `--count` / `-c` | How many to add |
| `--last` / `-l` | Last number already used (next is `last + 1`) |
| `--pad` | Zero-pad width (`--pad 3` → `CAM001`) |
| `--sep` | Separator (`--sep -` → `CAM-101`) |
| `--delay` | ms between entries (default `400`) |
| `--countdown` | seconds before typing (default `5`) |
| `--dry-run` | Print only; no keyboard |

```bash
node src/cli.js -n CAM -c 10 -l 100 --dry-run
npx flex-auto-counter -n STG -c 5 -l 42 --pad 3 --sep -
```

## How it works

1. Builds the serial list: `name + (last+1)` … `name + (last+count)`.
2. Countdown so you can focus the Serial Number field.
3. For each serial: types it via macOS System Events, presses Return, waits `--delay`.
4. Flex keeps the modal open (same as the practice form), so the next type goes into Serial Number again.

Live keyboard typing is **macOS-only** for now. `--dry-run` and the serial math work anywhere Node 18+ runs.

## Share / install

```bash
git clone <your-repo-url> flex-auto-counter
cd flex-auto-counter
npm link   # optional: puts `flex-auto-counter` on your PATH
```

## Tests

```bash
npm test          # serial number generation
npm run demo      # dry-run sample
npm run test-form # local HTML stand-in for the Flex modal
```
