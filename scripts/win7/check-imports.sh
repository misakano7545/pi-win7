#!/usr/bin/env bash
#
# Compare every PE in a built package against the Windows 7 import baseline.
#
# A missing DLL export is what actually breaks a program on Windows 7, and the
# loader fails before any compatibility shim can run -- so the shim "Windows 7
# compatibility mode" cannot test this. Scanning the import table can.
#
# The point is the diff, not a full list of Windows 7 exports: a baseline that
# only changes when a binary changes turns "does this run on Windows 7?" into a
# reviewable one-line diff.
#
# Usage:
#   ./scripts/win7/check-imports.sh <package-dir>            # fail on any change
#   ./scripts/win7/check-imports.sh --write <package-dir>    # refresh the baseline

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASELINE="$ROOT/scripts/win7/import-baseline.txt"

write=0
if [[ "${1:-}" == "--write" ]]; then
    write=1
    shift
fi

dir="${1:-}"
[[ -n "$dir" && -d "$dir" ]] || { echo "usage: $0 [--write] <package-dir>" >&2; exit 2; }

command -v objdump >/dev/null 2>&1 || { echo "missing tool: objdump (binutils)" >&2; exit 1; }

scan() {
    local pe rel symbols
    while IFS= read -r pe; do
        rel="${pe#"$dir"/}"
        # Imported names only. The row shape is "<vma> <ordinal> <hint> <name> <addr>";
        # keying off the ordinal spelling ("<none>") broke on binutils 2.42, so
        # accept any row whose last field is a name, minus the table headers.
        symbols="$(objdump -p "$pe" 2>&1 | awk '
            /DLL Name:/ { dll = $3; next }
            dll != "" && NF >= 2 && $NF ~ /^[A-Za-z_]/ && $NF != "Member-Name" && $NF != "Bound-To" { print dll "/" $NF }
        ' | sort -u)"
        [[ -n "$symbols" ]] || {
            {
                echo "$rel: no imports parsed, refusing to compare ($(objdump --version | head -1))"
                echo "--- objdump -p output, first 30 lines ---"
                objdump -p "$pe" 2>&1 | head -30
            } >&2
            exit 1
        }
        sed "s|^|${rel}: |" <<<"$symbols"
    done < <(find "$dir" \( -name '*.exe' -o -name '*.dll' -o -name '*.node' \) -type f | sort)
}

current="$(mktemp)"
trap 'rm -f "$current"' EXIT
scan >"$current"

if [[ $write -eq 1 ]]; then
    {
        echo "# Windows 7 import baseline -- regenerate: scripts/win7/check-imports.sh --write <package-dir>"
        echo "# A new symbol here needs a human answer to: does Windows 7 export it?"
        cat "$current"
    } >"$BASELINE"
    echo "baseline written: $BASELINE ($(grep -c . "$BASELINE") lines)"
    exit 0
fi

[[ -f "$BASELINE" ]] || { echo "no baseline at $BASELINE; run with --write" >&2; exit 1; }

if grep -v '^#' "$BASELINE" | diff -u - "$current"; then
    echo "imports unchanged ($(grep -vc '^#' "$BASELINE") entries across $(cut -d: -f1 "$current" | sort -u | wc -l) binaries)"
else
    echo "import baseline changed -- confirm every added symbol exists on Windows 7," >&2
    echo "then refresh with: scripts/win7/check-imports.sh --write <package-dir>" >&2
    exit 1
fi
