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

Verified here (no Windows involved):

- `gypfile` count 0; the two wasm deps (`photon-node`, `quickjs-wasi`) are
  platform-independent.
- pi tree starts on Node and prints `1.1.0`; `-p` reaches the missing-credential
  path; `list` works after the esbuild strip.
- Import tables: `node.exe`, `rg.exe`, `fd.exe` and `pi-tui`'s
  `win32-platform.node` import nothing newer than Windows Vista.
- `rg.exe` archive sha256 matches BurntSushi's published `.sha256` sidecar.

Not verified, and not verifiable in CI:

- Whether `node.exe` actually starts on Windows 7, and how the TUI renders in
  mintty/ConEmu. GitHub's supported self-hosted runners start at Server 2016 and
  `windows-2019` is retired, so CI's oldest Windows is Server 2022 -- as far from
  Windows 7 as the developer's own machine.
- The upstream terminal documentation covers Windows Terminal but has no ConEmu
  or mintty section, so the terminal layer has no upstream backing at all.

Run `verify.ps1` (shipped inside the package) on the real machine and paste the
output into the pull request.

## Shipping

Tag `win7-v<pi version>-<package revision>` (for example `win7-v1.1.0-1`) and
push the tag; `win7-package.yml` builds, verifies, and only then creates the
release. Release as its own release, never attached to an upstream tag: the
upstream tags are already in this repository, and a bare version tag would
collide with them.

Re-distribution caveat: the Node runtime comes from a repository with no license
file, so shipping it is a deliberate decision that must be stated in the release
notes.
