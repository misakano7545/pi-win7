#!/usr/bin/env node
/**
 * The console shims are all that stands between Pi and a garbled frame on Windows 7, and
 * one of them shipped broken: the width shim patched only getters, while Node exposes
 * `process.stdout.columns/rows` as instance data properties, so `defineProperty` never
 * matched, the shim did nothing at all, and the garble survived two commits that claimed
 * to fix it. Nothing about that failure is visible without a Windows 7 console, so every
 * shim is exercised here for real rather than trusted to parse.
 *
 * The Windows-only guards these shims open with are configurable, so a preload puts each
 * one into the state it sees on the target -- `process.platform` becomes `win32`, stdout
 * claims to be a TTY -- which is how the colour and glyph transforms are covered without
 * Windows.
 *
 * Usage: node scripts/win7/check-shims.mjs [package dir]
 *        (default: the source package, scripts/win7/package)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHIMS = ["win7-tty-width.cjs", "win7-boxascii.cjs", "win7-ansi16.cjs"];

const WIN32_TTY = `Object.defineProperty(process, "platform", { value: "win32" });
Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
`;

/**
 * The two shapes the console size has had: the accessor Node used to expose, and the
 * instance data property it uses now.
 */
const SIZE_FORMS = {
	"data property": `for (const [name, value] of [["columns", 120], ["rows", 33]]) {
	Object.defineProperty(process.stdout, name, { value, writable: true, enumerable: true, configurable: true });
}
`,
	accessor: `const stored = { columns: 120, rows: 33 };
for (const name of ["columns", "rows"]) {
	Object.defineProperty(process.stdout, name, {
		enumerable: true,
		configurable: true,
		get() { return stored[name]; },
		set(value) { stored[name] = value; },
	});
}
`,
};

/**
 * What this console cannot draw, and what it must be handed instead. The CJK text is
 * deliberate: the glyph shim has to leave it alone, and the colour one must not eat the
 * basic SGR the console does understand.
 */
const TRANSFORMS = [
	[
		"win7-ansi16.cjs",
		"\u001b[38;2;255;0;0mR\u001b[38;5;196mR\u001b[48;5;21mB\u001b[0m\u001b[31mplain\n",
		"\u001b[91mR\u001b[91mR\u001b[104mB\u001b[0m\u001b[31mplain\n",
	],
	["win7-boxascii.cjs", "─│┌▶• 中文测试\n", "-|+>* 中文测试\n"],
];

const dir = process.argv[2] ?? fileURLToPath(new URL("./package/", import.meta.url));
const node = process.execPath;
const temporary = mkdtempSync(join(tmpdir(), "win7-shims-"));
let failed = false;

function check(what, ok, detail = "") {
	console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? ` -- ${detail}` : ""}`);
	if (!ok) failed = true;
}

/** Last line of a child's failure, without the whole stack. */
function reason(error) {
	return String(error.stderr || error.message || error).trim().split("\n").slice(-1)[0];
}

/** Run `script` in a node that loaded `preload` and then `shim`, and return what it printed. */
function probe(preload, shim, script) {
	const path = join(temporary, `preload-${Math.random().toString(36).slice(2)}.cjs`);
	writeFileSync(path, preload);
	return execFileSync(node, ["--require", path, "--require", resolve(dir, shim), "-e", script], {
		encoding: "utf8",
	});
}

try {
	for (const shim of SHIMS) {
		const path = join(dir, shim);
		if (!existsSync(path)) {
			check(`${shim} is in the package`, false, "missing");
			continue;
		}
		try {
			execFileSync(node, ["--check", path]);
			check(`${shim} parses`, true);
		} catch (error) {
			check(`${shim} parses`, false, reason(error));
		}
	}

	// pi.bat is the only entry point a user runs, so it must load every shim.
	const launcher = existsSync(join(dir, "pi.bat")) ? readFileSync(join(dir, "pi.bat"), "utf8") : "";
	for (const shim of SHIMS) {
		check(`pi.bat loads ${shim}`, launcher.includes(`--require "%ROOT%${shim}"`));
	}

	for (const [form, preload] of Object.entries(SIZE_FORMS)) {
		// Read the size back, then assign one the way Node's own resize callback does: the
		// shim must adjust the first and still let the second through.
		const script =
			"process.stdout.columns = 100;" +
			"process.stdout.write(JSON.stringify([process.stdout.columns, process.stdout.rows]));";
		let got;
		try {
			got = probe(preload, "win7-tty-width.cjs", script).trim();
		} catch (error) {
			check(`width shim adjusts the ${form}`, false, reason(error));
			continue;
		}
		check(`width shim adjusts the ${form}`, got === "[99,32]", `120x33 -> ${got}, want [99,32]`);
	}

	for (const [shim, input, expected] of TRANSFORMS) {
		let got;
		try {
			got = probe(WIN32_TTY, shim, `process.stdout.write(${JSON.stringify(input)});`);
		} catch (error) {
			check(`${shim} rewrites what the console cannot draw`, false, reason(error));
			continue;
		}
		check(
			`${shim} rewrites what the console cannot draw`,
			got === expected,
			got === expected ? "" : `got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`,
		);
	}
} finally {
	rmSync(temporary, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
