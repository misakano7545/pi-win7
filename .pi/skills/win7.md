---
name: win7
description: Build and ship the Windows 7 distribution of pi. Use when touching scripts/win7, the win7-package workflow, or anything about running pi on Windows 7.
---

# Windows 7 distribution

Work on `main`. It is a fork of upstream (`earendil-works/pi`) that also carries the
Windows 7 package, so keep every Windows 7 change inside `scripts/win7/`,
`.pi/skills/win7.md` and the win7-package workflow: that is what keeps
`git fetch upstream && git merge upstream/main` conflict-free. `win7-package.yml` builds
on `main`; the fork keeps no other branch: the one-off `win7` branch it was developed on
is gone, and upstream's branches were dropped from the fork (the `upstream` remote still
has them).

## Why a separate package exists

The official `pi-windows-x64.zip` ships `pi.exe`, compiled with Bun, which
requires Windows 10 1809 or newer. Windows 7 therefore needs a Node runtime
plus the pi tree. There is no supported single-file option.

## Frozen components

Each is the last build that still runs on Windows 7. Do not bump one without
re-running the checks in this skill.

| Component | Version | Why this one |
|---|---|---|
| Node runtime | DeftKing/nodejs-win7 `v22.23.2` | official Node.js dropped Windows 7 in v20.3.0 (`GetSystemTimePreciseAsFileTime`); this community build removed that import |
| PortableGit `git/` | 2.46.2 | last release supporting Windows 7; supplies bash for Pi's bash tool and mintty, the terminal that can report modified keys |
| ripgrep `rg.exe` | 14.1.0 | 14.1.1 was built with Rust 1.78, whose Windows targets require Windows 10 |
| fd `fd.exe` | 10.3.0 | 10.4.0 raised the MSRV to 1.90 and dropped Windows 7 |
| pi | 1.2.0 | pinned; newer releases raise the Node feature floor again |

pi's real Node floor is 22.12, not the `engines` field's 22.19 -- measured, see
the table below. Never edit `engines`; it is upstream's publish contract and a
merge conflict every time.

## Red lines

- No new native dependencies (`gypfile`) and no `node-pty`: pi needs neither, and
  both would add Windows-version risk for no gain.
- `@esbuild/win32-x64/esbuild.exe` must never ship: it is a Go binary, Go 1.21+
  requires Windows 10. It is reachable only via `@earendil-works/chord`, which
  the bundled CLI never loads. `build-package.sh` strips it and fails if it
  reappears; the workflow asserts it too.
- No `pi.exe`, no Bun, no standalone binary: Bun's Windows floor is 10 1809+.
- Commodity tools stay pinned to the versions above; PI's `tools-manager.ts`
  downloads the *latest* ripgrep/fd into `<agent-dir>/bin` and only checks that
  the file exists, so a downloadable build would shadow the working one forever.
- Do not use Windows compatibility mode (`__COMPAT_LAYER=WIN7RTM`) as a test.
  Shims redirect already-resolved imports; they cannot supply a missing export,
  so that check passes on any modern Windows and proves nothing.

## Build, check, verify

```bash
./scripts/win7/build-package.sh                  # -> .artifacts/pi-win7-x64.zip
./scripts/win7/check-imports.sh .artifacts/pi-win7-x64   # import baseline diff
./scripts/win7/check-imports.sh --write .artifacts/pi-win7-x64   # refresh it
```

`build-package.sh` verifies the sha256 of every downloaded archive and fails on
a mismatch. The zip itself is not byte-reproducible (timestamps, compressor),
so the frozen artifact is the component list in `CHECKSUMS.txt` inside it.

The import baseline is the only automated answer to "will this run on Windows 7":
a missing export is the real failure mode, and it is visible statically. When it
changes, answer "does Windows 7 export this symbol?" for each added line before
refreshing.

## What is verified, and what is not

Verified on real hardware -- Windows 7 Enterprise SP1 (6.1.7601), PowerShell 2.0,
`verify.ps1` run straight out of the archive:

| Check | Result |
|---|---|
| `node --version` | v22.23.2 |
| `node.exe` sha256 | matches CHECKSUMS.txt |
| `pi --version` | 1.2.0 |
| `rg --version` | ripgrep 14.1.0 |
| `fd --version` | fd 10.3.0 |

The central bet holds: a Node build with the Windows 8+ imports removed does start
pi on Windows 7, and PowerShell 2.0 runs verify.ps1.

Verified here (no Windows involved):

- `gypfile` count 0; the two wasm deps (`photon-node`, `quickjs-wasi`) are
  platform-independent.
- pi tree starts on Node and prints `1.2.0`; `-p` reaches the missing-credential
  path; `list` works after the esbuild strip.
- Import tables: `node.exe`, `rg.exe`, `fd.exe` and `pi-tui`'s
  `win32-platform.node` import nothing newer than Windows Vista.
- `rg.exe` archive sha256 matches BurntSushi's published `.sha256` sidecar.

The TUI itself was measured on the target machine with the shims below loaded; see the
next section. CI still cannot.

CI cannot cover any of this: the oldest Windows runner is Server 2022 and
`windows-2019` is retired, so the Windows job proves the package is intact, not
that Windows 7 runs it. `verify.ps1` on the real machine is the only evidence.

## Terminal behaviour on Windows 7

Measured on the real machine with pi 1.2.0: the console is code page 936, has 16
colours (`hasColors()=true`, `hasColors(256)=false`, `getColorDepth()=4`) and reports
120x33 after pi.bat's `mode con`. It has no VT support, so it does not draw Pi's TUI
unaided: Pi classifies every `win32` console as truecolour, and
`ReadConsoleOutputAttribute` reads `0x04` red for `31m`, `0x87` (a wrong attribute) for
`38;5;196m` and `0x07` (dropped) for `38;2;255;0;0m`. The earlier note here -- that
colours render correctly and that Node reports 80x25 -- was wrong; do not repeat it.

Two limits come from the console's API surface rather than from pi: the drawing ones are
worked around by the shims below, the input one cannot be.

Input: `packages/tui/native/win32/src/win32-platform.c` enables
`ENABLE_VIRTUAL_TERMINAL_INPUT` (0x0200), added in Windows 10 1511. On Windows 7
`SetConsoleMode` rejects it, the helper returns false, and `terminal.ts` ignores
that result -- modifier keys arrive stripped, so `Shift+Enter` is
indistinguishable from `Enter`. Use `Ctrl+J` for a newline. No package change can
fix this.

## Open question: mintty opens but starts nothing

On the real machine `mintty.exe <node.exe> <cli.js>` produces a window whose title is
the command line (so mintty received it) and an empty body. Empty plus a window that
stays open is mintty's "could not execute the program" case, but the candidates are
eliminated: the paths have no spaces, the archive ships `git/etc/passwd` (10 entries,
asserted in CI), and the same node.exe plus cli.js runs fine in the console. The
runner cannot help -- without an interactive desktop mintty exits in about half a
second -- so this is only diagnosable on the target.

The console route stays the default and works; only multi-line input is unavailable
there.

The package ships three shims, all loaded with `node --require` on the console path
only; mintty is a real pty and gets none of them. None of them touch `node_modules`, so
a Pi upgrade keeps them, and `scripts/win7/check-shims.mjs` asserts in CI that they ship,
parse, are loaded by `pi.bat` and still adjust the console size.

`win7-tty-width.cjs` reports one less column and one less row so Pi never touches either
edge. Windows 7's console wraps and scrolls as soon as the last cell or the last row is
written, where xterm defers that until the next character. Without it a full-width line
scrolls the screen, Pi's model of the screen goes a row out of sync, and the frame is
drawn garbled -- visibly a missing first character, a duplicated footer, a line appearing
as you type, and an input box one row too tall. Both edges matter: fixing columns alone
left the bottom broken. The alt screen attempts the same thing with `\x1b[?7l`, which
this console ignores.

It also has to wrap *data properties*. Node exposes `process.stdout.columns/rows` by
assigning `this.columns = w` from its window-size callback, not through a getter. The
first version of this shim patched getters only (`if (!descriptor?.get) continue`), so
`defineProperty` never matched, the shim did nothing at all, Node kept reporting the full
console size, and the garble survived two commits that claimed to fix it. Handle both
shapes, and keep a setter so Node's own resize writes still land.

`win7-boxascii.cjs` exists because code page 936 (and 932, 949, 950) makes this console
draw East Asian "ambiguous width" characters -- box drawing, blocks, bullets, arrows --
twice as wide as Pi measures them: on a 120-column console a rule comes back as 60
characters and wraps, so the input box becomes a block of horizontal lines and the footer
and status rows shift down. Rewriting those glyphs to one-column ASCII (`+ - | # * < > ^ v`)
fixes the layout without touching the code page, which is the point: `chcp 437` narrows
the borders but the console can then no longer display Chinese at all ("中文测试" becomes
"????"), and Windows 7's UTF-8 code page (65001) draws nothing. There is no code-page
shim, and adding one back would break Chinese.

`win7-ansi16.cjs` rewrites `38;5;N` and `38;2;r;g;b` to the nearest of the 16 colours the
console has, weighted for the eye. Pi treats every `win32` console as truecolour, which
is right for Windows 10 and wrong here: truecolour is dropped and 256-colour lands on a
wrong attribute, so colours vanish and some text turns into inverse blocks. The console
path is therefore 16-colour with ASCII borders -- this environment's limit, not a
regression.

The colour and glyph shims take `PI_WIN7_ANSI16=0` / `PI_WIN7_BOXASCII=0` to compare
against the old behaviour, and none of the three applies when stdout is redirected, so
`--mode json` output stays clean.

The package ships `agent/settings.json` with `terminal.clearOnShrink: true`: the
console does not repaint rows the frame stopped using, so a line the editor vacated
(an input row the console's stray bytes created) lingers for the whole session.

`tui.input.newLine` defaults to `["shift+enter", "ctrl+j"]`, and `ctrl+j` is byte
0x0A. That makes the phantom line unavoidable by any other route: an editor line can
only be inserted by Shift+Enter or Ctrl+J, and Shift+Enter never arrives on this
console -- so the stray byte must be a line feed. The package therefore ships
`agent/keybindings.json` with `["shift+enter"]` only.

Cost, stated plainly: the console then has no newline key at all. There is no free
Ctrl+<letter> to reassign -- the unused ones are Ctrl+H, Ctrl+I and Ctrl+M, which are
Backspace, Tab and Enter -- and the remaining modifier combinations do not survive
this console either. Multi-line prompts require mintty.

Layout: at 80 columns the TUI is cramped -- long paths split mid-word and the
status area collides. `pi.bat` sets 120x34 with `mode con`; if the screen is too
small for that, the call fails silently and the console keeps its size.

## Shipping

Tag `win7-v<pi version>-<package revision>` (for example `win7-v1.1.0-1`) and
push the tag; `win7-package.yml` builds, verifies, and only then creates the
release. Release as its own release, never attached to an upstream tag: the
upstream tags are already in this repository, and a bare version tag would
collide with them.

Re-distribution caveat: the Node runtime comes from a repository with no license
file, so shipping it is a deliberate decision that must be stated in the release
notes.
