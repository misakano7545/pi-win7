#!/usr/bin/env bash
#
# Build the self-contained Pi package for Windows 7.
# Mirrors .github/workflows/win7-package.yml
#
# Usage:
#   ./scripts/win7/build-package.sh [--out <dir>]
#
# Options:
#   --out <dir>   Output directory (default: .artifacts)
#
# Output:
#   .artifacts/pi-win7-x64/       unpacked package
#   .artifacts/pi-win7-x64.zip    release asset
#
# Why this exists: pi.exe (the official single-file build) is compiled with Bun,
# which requires Windows 10 1809 or newer, so Windows 7 needs a Node runtime
# instead. Every component below is pinned to the last build that still runs on
# Windows 7 -- see .pi/skills/win7.md for the evidence and the red lines.

set -euo pipefail

PI_VERSION="1.1.0"
NODE_TAG="v22.23.2"
NODE_ARCHIVE="node-v22.23.2-win-x64.7z"
RG_VERSION="14.1.0"
FD_VERSION="v10.3.0"
GIT_TAG="v2.46.2.windows.1"
GIT_ARCHIVE="PortableGit-2.46.2-64-bit.7z.exe"

# Frozen upstream artifact hashes. ripgrep and fd publish no signature, so this is
# the only provenance anchor for them: verify once by hand, then freeze here.
RG_SHA256="fe4f75edfaa50f0d4fecbf47696b7629f3449c9c2c5a4da828753139e5a2e203"
FD_SHA256="318aa2a6fa664325933e81fda60d523fff29444129e91ebf0726b5b3bcd8b059"
NODE_SHA256="78974ffc058fc73e72633b5772f2b162e0d26ddb8bf6a03214f202291617f618"
# Taken from the SHA-256 table in the Git for Windows release notes, not computed here.
GIT_SHA256="58ae5c1a27d3f9ce8518c1a187860973cfa4dd604f518350e84f7baf418fc9fa"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT/.artifacts"
CACHE_DIR="$OUT_DIR/win7-downloads"
PKG_DIR="$OUT_DIR/pi-win7-x64"
ZIP_PATH="$OUT_DIR/pi-win7-x64.zip"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out) OUT_DIR="$2"; CACHE_DIR="$OUT_DIR/win7-downloads"; PKG_DIR="$OUT_DIR/pi-win7-x64"; ZIP_PATH="$OUT_DIR/pi-win7-x64.zip"; shift 2 ;;
        -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done

require() {
    command -v "$1" >/dev/null 2>&1 || { echo "missing tool: $1" >&2; exit 1; }
}

# 7z extracts the Node archive and writes the release zip, so one tool covers both.
require 7z
require node
require npm
require sha256sum

mkdir -p "$CACHE_DIR" "$PKG_DIR"

fetch() {
    local url="$1" dest="$2" want="$3"
    if [[ ! -f "$dest" ]]; then
        echo "downloading $(basename "$dest")"
        curl -fsSL --retry 3 -o "$dest" "$url"
    fi
    local got
    got="$(sha256sum "$dest" | cut -d' ' -f1)"
    [[ "$got" == "$want" ]] || { echo "sha256 mismatch for $(basename "$dest"): $got != $want" >&2; exit 1; }
}

fetch "https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/ripgrep-${RG_VERSION}-x86_64-pc-windows-msvc.zip" \
    "$CACHE_DIR/rg.zip" "$RG_SHA256"
fetch "https://github.com/sharkdp/fd/releases/download/${FD_VERSION}/fd-${FD_VERSION}-x86_64-pc-windows-msvc.zip" \
    "$CACHE_DIR/fd.zip" "$FD_SHA256"
fetch "https://github.com/DeftKing/nodejs-win7/releases/download/${NODE_TAG}/${NODE_ARCHIVE}" \
    "$CACHE_DIR/node.7z" "$NODE_SHA256"
fetch "https://github.com/git-for-windows/git/releases/download/${GIT_TAG}/${GIT_ARCHIVE}" \
    "$CACHE_DIR/$GIT_ARCHIVE" "$GIT_SHA256"

# --- runtime and search tools -------------------------------------------------

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/agent/bin" "$PKG_DIR/node" "$PKG_DIR/pi"

unpack="$(mktemp -d)"
trap 'rm -rf "$unpack"' EXIT

7z x -y -o"$unpack/rg" "$CACHE_DIR/rg.zip" >/dev/null
7z x -y -o"$unpack/fd" "$CACHE_DIR/fd.zip" >/dev/null
7z x -y -o"$unpack/node" "$CACHE_DIR/node.7z" >/dev/null

cp "$(find "$unpack/rg" -name rg.exe | head -1)" "$PKG_DIR/agent/bin/rg.exe"
cp "$(find "$unpack/fd" -name fd.exe | head -1)" "$PKG_DIR/agent/bin/fd.exe"
cp -r "$unpack/node/${NODE_ARCHIVE%.7z}/." "$PKG_DIR/node/"

# --- portable Git ------------------------------------------------------------

# Supplies bash for Pi's bash tool and mintty as the terminal, so the package needs
# nothing installed. The .7z.exe is a self-extracting archive; 7z reads its payload
# directly, and post-install.bat runs from pi.bat on first launch since it needs
# Windows. The whole prefix is kept: trimming mingw64/ or usr/ breaks bash in ways
# that only show up on the target machine.
7z x -y -o"$PKG_DIR/git" "$CACHE_DIR/$GIT_ARCHIVE" >/dev/null
for f in usr/bin/bash.exe usr/bin/mintty.exe cmd/git.exe; do
    [[ -f "$PKG_DIR/git/$f" ]] || { echo "PortableGit extraction produced no $f" >&2; exit 1; }
done

# --- pi runtime tree ---------------------------------------------------------

# --os/--cpu are not cosmetic: npm otherwise installs the host's optional
# platform packages (e.g. @esbuild/linux-x64), which then break on Windows.
npm install --ignore-scripts --omit=dev --no-audit --no-fund \
    --os=win32 --cpu=x64 \
    @earendil-works/pi-coding-agent@"$PI_VERSION" \
    --prefix "$PKG_DIR/pi" \
    ${NPM_REGISTRY:+--registry "$NPM_REGISTRY"}

PI_PKG="$PKG_DIR/pi/node_modules/@earendil-works/pi-coding-agent"

# esbuild is the only binary in the tree that requires Windows 10 (Go build).
# It is reachable only through @earendil-works/chord, which the bundled CLI never
# loads, so drop it rather than pretend the package supports it.
# shortcut: if the CLI ever loads chord again, esbuild must come back with a
# Windows 7-capable alternative; check-imports.sh and the CI assert catch that.
rm -rf "$PKG_DIR/pi/node_modules/esbuild" "$PKG_DIR/pi/node_modules/@esbuild" \
       "$PKG_DIR/pi/node_modules/.bin"
if find "$PKG_DIR" -name 'esbuild*' -print -quit | grep -q .; then
    echo "esbuild reappeared in the package" >&2
    exit 1
fi

# Only the win32 prebuild is usable; the others are dead weight in a Windows package.
rm -rf "$PKG_DIR/pi/node_modules/@earendil-works/pi-tui/native/darwin" \
       "$PKG_DIR/pi/node_modules/@earendil-works/pi-tui/native/linux" \
       "$PKG_DIR/pi/node_modules/@earendil-works/pi-tui/native/win32/prebuilds/win32-arm64"

# --- package files -----------------------------------------------------------

cp "$ROOT/scripts/win7/package/pi.bat" "$ROOT/scripts/win7/package/README.txt" \
   "$ROOT/scripts/win7/package/verify.ps1" "$PKG_DIR/"

cat >"$PKG_DIR/node/SOURCES.txt" <<EOF
node.exe ${NODE_TAG} -- DeftKing/nodejs-win7 ${NODE_ARCHIVE}
  archive sha256 ${NODE_SHA256}
  community build: official Node.js dropped Windows 7 in v20.3.0
rg.exe ${RG_VERSION} -- BurntSushi/ripgrep x86_64-pc-windows-msvc
  archive sha256 ${RG_SHA256}
fd.exe ${FD_VERSION} -- sharkdp/fd x86_64-pc-windows-msvc
  archive sha256 ${FD_SHA256}
pi ${PI_VERSION} -- @earendil-works/pi-coding-agent from the npm registry
EOF

cat >"$PKG_DIR/git/SOURCE.txt" <<EOF
PortableGit ${GIT_TAG} -- git-for-windows/git ${GIT_ARCHIVE}
  archive sha256 ${GIT_SHA256} (published in the release notes)
  GPLv2, redistributed unmodified as a separate program
EOF

(
    cd "$PKG_DIR"
    {
        printf '%s\n' "# verify with: sha256sum -c CHECKSUMS.txt (run from the package root)"
        sha256sum node/node.exe \
            agent/bin/rg.exe \
            agent/bin/fd.exe \
            node/SOURCES.txt \
            pi/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js \
            pi/node_modules/@earendil-works/pi-tui/native/win32/prebuilds/win32-x64/win32-platform.node
    } >CHECKSUMS.txt
)

# --- archive -----------------------------------------------------------------

# 7z rather than zip(1): 7z is already required above, and naming the top-level
# entries keeps the archive flat like the official pi-windows-x64.zip.
rm -f "$ZIP_PATH"
(cd "$PKG_DIR" && 7z a -tzip -mx=6 "$ZIP_PATH" ./* >/dev/null)

echo
echo "package: $PKG_DIR"
echo "archive: $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"
echo "component hashes: see $PKG_DIR/CHECKSUMS.txt"
