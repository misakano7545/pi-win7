---
name: win7
description: Build and ship the Windows 7 distribution of pi. Use when touching scripts/win7, the win7-package workflow, the win7 branch, or anything about running pi on Windows 7.
---

# Windows 7 distribution

Work on the `win7` branch. `main` stays a byte-for-byte mirror of upstream
(`earendil-works/pi`) so `git fetch upstream && git merge upstream/main` keeps
working; nothing Windows 7-specific may land on `main`.

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
| pi | 1.1.0 | pinned; newer releases raise the Node feature floor again |

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
| `pi --version` | 1.1.0 |
| `rg --version` | ripgrep 14.1.0 |
| `fd --version` | fd 10.3.0 |

The central bet holds: a Node build with the Windows 8+ imports removed does start
pi on Windows 7, and PowerShell 2.0 runs verify.ps1.

Verified here (no Windows involved):

- `gypfile` count 0; the two wasm deps (`photon-node`, `quickjs-wasi`) are
  platform-independent.
- pi tree starts on Node and prints `1.1.0`; `-p` reaches the missing-credential
  path; `list` works after the esbuild strip.
- Import tables: `node.exe`, `rg.exe`, `fd.exe` and `pi-tui`'s
  `win32-platform.node` import nothing newer than Windows Vista.
- `rg.exe` archive sha256 matches BurntSushi's published `.sha256` sidecar.

Still unverified: the TUI itself (see below).

CI cannot cover any of this: the oldest Windows runner is Server 2022 and
`windows-2019` is retired, so the Windows job proves the package is intact, not
that Windows 7 runs it. `verify.ps1` on the real machine is the only evidence.

## Terminal behaviour on Windows 7

Measured on the real machine: pi 1.1.0 renders colours and escape sequences
correctly in the Windows 7 console, and Node reports 80x25 there. So "the old
console cannot draw the TUI" is wrong -- do not repeat it.

The two limits that are real both come from the console's API surface, not pi:

Input: `packages/tui/native/win32/src/win32-platform.c` enables
`ENABLE_VIRTUAL_TERMINAL_INPUT` (0x0200), added in Windows 10 1511. On Windows 7
`SetConsoleMode` rejects it, the helper returns false, and `terminal.ts` ignores
that result -- modifier keys arrive stripped, so `Shift+Enter` is
indistinguishable from `Enter`. Use `Ctrl+J` for a newline. No package change can
fix this.

Layout: at 80 columns the TUI is cramped -- long paths split mid-word and the
status area collides. Run it in a window at least ~100 columns wide (cmd.exe
window properties, or mintty, which is resizable).

## Shipping

Tag `win7-v<pi version>-<package revision>` (for example `win7-v1.1.0-1`) and
push the tag; `win7-package.yml` builds, verifies, and only then creates the
release. Release as its own release, never attached to an upstream tag: the
upstream tags are already in this repository, and a bare version tag would
collide with them.

Re-distribution caveat: the Node runtime comes from a repository with no license
file, so shipping it is a deliberate decision that must be stated in the release
notes.
