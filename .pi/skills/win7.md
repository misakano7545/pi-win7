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
worked around by the shims below, and the input ones are why an interactive start uses
mintty.

Input: `packages/tui/native/win32/src/win32-platform.c` enables
`ENABLE_VIRTUAL_TERMINAL_INPUT` (0x0200), added in Windows 10 1511. On Windows 7
`SetConsoleMode` rejects it, the helper returns false, and `terminal.ts` ignores
that result -- modifier keys arrive stripped, so `Shift+Enter` is
indistinguishable from `Enter`. No package change can fix this. mintty is a real pty
and reports `\x1b[13;2u`, so the binding works there.

Mouse: the console never delivers mouse input to a Node process. libuv reads only
`KEY_EVENT` records, and Win7 conhost ignores the xterm mouse modes Pi writes when it
enters the alt screen (`?1000h`, `?1002h`, `?1003h`, `?1004h`, `?1006h`), so the wheel
cannot scroll the transcript; `node.exe` carries no mouse escape sequence and no
`ENABLE_MOUSE_INPUT`. mintty reports SGR wheel events (`\x1b[<64;...M`), which is the
whole reason it is now the default. In the console, PageUp/PageDown scroll instead --
libuv translates them to `\x1b[5~` / `\x1b[6~`.

## The console tier: Windows 10 and later draw the colour natively

The colour and glyph shims are gated on the OS version, not just on `win32`:
`os.release()` major < 10 (Windows 7 is 6.1, 8 is 6.2, 8.1 is 6.3) means the old console,
and 10.0 and up means a console that understands VT output, reports the mouse and draws box
drawing and true colour properly, so those two stand down there. `pi.bat` decides once with
the bundled Node, exports `PI_WIN7_CONSOLE_SHIMS=1`, and opens mintty only when that is set;
each shim reads the same version itself. Exporting the variable forces the tier on a newer
Windows and `=0` forces it off -- that is how to reproduce either path on a machine you
actually have.

The width shim is *not* part of that tier, and gating it there was a mistake worth
remembering. On a Windows 11 console (`os.release()` 10.0.26300) with the shim switched off,
the documented Windows 7 symptom came straight back: the input box and the working-directory
line gone from the bottom, every row above intact. Measured on that machine: the rows the
missing widgets should occupy were pure background, so nothing was drawn there at all --
that is a frame one row out of place, not a colour problem, and Pi's own renderer has no
"hide the editor" path. So the width shim runs on every Windows console (conhost scrolls on
the last cell on either version; Windows Terminal defers the wrap the way xterm does and
merely pays the blank column and row) and its switch is `PI_WIN7_TTY_WIDTH=0`. The TTY shim
is not gated either: native Node cannot see mintty's pty as a TTY on any Windows version.

The tier also has a height test, because being new is not enough to host the TUI. Windows
Terminal keeps its own window size, so `mode con cols=120 lines=34` cannot grow it: the
console stayed at 30 rows, and Pi's editor and working-directory line were drawn outside the
visible area -- maximising the window brought both back, which is what identified the cause.
`pi.bat` therefore asks for 120x34 first and then takes the compatibility path when the
console is older than 10.0 *or* shorter than 34 rows. Measured: 30 rows breaks, 34 and above
work; the exact minimum between them was not measured, and mintty always opens at 34 because
the launcher passes `-s 120,34`.

## mintty is the interactive default

An interactive start with no arguments, and with `TERM` unset, opens Pi in the bundled
mintty: it is the only way to get mouse-wheel scrolling, `Shift+Enter` and truecolour on
Windows 7. `PI_WIN7_CONSOLE=1` (or `PI_WIN7_MINTTY=0`) keeps the console path, where
PageUp/PageDown scroll and there is no newline key.

Never infer success from mintty's exit status: it returns in about 30ms because its
window is a separate process, and it can exit 0 without ever starting its child -- the
"mintty opens but starts nothing" question this file used to leave open. `pi.bat`
therefore goes through `win7-mintty-launch.cjs`, which writes a probe file and watches
for `win7-mintty-probe.cjs`, loaded in the child, to delete it. A probe that survives the
timeout (8s -- antivirus scanning `node.exe` delays the first start) means mintty
failed: the launcher exits 1 and `pi.bat` prints a hint and falls back to the console.
CI cannot test any of it: mintty needs an interactive desktop.

The package ships six shims. Four load on the console path: the two drawing ones (old
console tier only), `win7-tty-width.cjs` (every Windows console), and
`win7-mintty-tty.cjs`, which is inert in a real console and matters when that path runs
inside an existing mintty; the mintty launcher loads the TTY and probe shims itself. None of
them touch `node_modules`, so a Pi upgrade keeps them,
and `scripts/win7/check-shims.mjs` asserts in CI that all six ship, parse, are wired up
correctly, adjust the console size, rewrite the colour and the glyphs, and fire only in
the state they are meant to.

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

Under mintty, native Windows Node sees the MSYS pty as a pair of named pipes: stdout's
constructor is `Socket`, and `isTTY`, `columns`, `rows`, `setRawMode` and `isRaw` do not
exist. Pi's `resolveAppMode()` then picks `print` and waits for piped input forever --
that, not the launcher, was the black window. Two more causes sit behind it: the pty
stays in canonical mode, so typing arrives only after Enter and SGR mouse reports, which
carry no newline, never arrive at all (`stty raw -echo` fixes it; `stty -a` then shows
`-icanon -echo -isig`); and mintty itself never waits for its child.

`win7-mintty-tty.cjs` presents the pty as a TTY: size from MSYS `stty size`, raw mode
through `stty raw -echo` / `stty sane` behind `setRawMode`, and a 1s `stty size` poll
that emits `resize`. It activates only for `TERM_PROGRAM=mintty` with a non-TTY stdout,
so a real console and redirected output are untouched -- and a rerun of `pi.bat` from
inside an existing mintty still starts interactive. `stty` always runs with `cwd` in the
temp directory, so an MSYS `*.stackdump` cannot land in the user's project.

`win7-mintty-launch.cjs` + `win7-mintty-probe.cjs` are the launcher and its probe. In a
read-only package folder the launcher cannot write a probe, so it starts mintty anyway
and trusts it -- the best it can do without one.

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
this console either. That is the fallback's cost only: the default path is mintty, where
`Shift+Enter` works.

Layout: at 80 columns the TUI is cramped -- long paths split mid-word and the
status area collides. `pi.bat` sets 120x34 with `mode con`, and the mintty launcher opens
its window at the same size with `-s 120,34`; if the screen is too small for that, the
`mode con` call fails silently and the console keeps its size.

## Shipping

Tag `win7-v<pi version>-<package revision>` (for example `win7-v1.1.0-1`) and
push the tag; `win7-package.yml` builds, verifies, and only then creates the
release. Release as its own release, never attached to an upstream tag: the
upstream tags are already in this repository, and a bare version tag would
collide with them.

Re-distribution caveat: the Node runtime comes from a repository with no license
file, so shipping it is a deliberate decision that must be stated in the release
notes.
