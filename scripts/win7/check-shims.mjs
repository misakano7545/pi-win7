#!/usr/bin/env node
/**
 * The shims are all that stands between Pi and a broken frame on Windows 7, and one of
 * them shipped broken: the width shim patched only getters, while Node exposes
 * `process.stdout.columns/rows` as instance data properties, so `defineProperty` never
 * matched, the shim did nothing at all, and the garble survived two commits that claimed
 * to fix it. None of that is visible without a Windows 7 machine, so every shim is
 * exercised here for real rather than trusted to parse.
 *
 * The Windows-only guards these shims open with are configurable, so a preload puts each
 * one into the state it sees on the target -- `process.platform` becomes `win32`, stdout
 * claims to be a TTY or not, `TERM_PROGRAM` says mintty -- which is how the colour,
 * glyph and mintty behaviour is covered without Windows. What cannot be covered here is
 * `git/usr/bin/stty.exe`, the real mintty window and the console's own rendering; those
 * need the target machine.
 *
 * Usage: node scripts/win7/check-shims.mjs [package dir]
 *        (default: the source package, scripts/win7/package)
 */

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHIMS = [
	"win7-tty-width.cjs",
	"win7-boxascii.cjs",
	"win7-ansi16.cjs",
	"win7-mintty-launch.cjs",
	"win7-mintty-probe.cjs",
	"win7-mintty-tty.cjs",
];

/** The console path loads these four; the mintty launcher loads the probe and tty shims itself. */
const PI_BAT_SHIMS = ["win7-tty-width.cjs", "win7-boxascii.cjs", "win7-ansi16.cjs", "win7-mintty-tty.cjs"];

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

/** Read back what the TTY shim decided, for the three states it has to tell apart. */
const TTY_STATE = `process.stdout.write(JSON.stringify([
	String(process.stdout.isTTY),
	String(process.stdout.columns),
	String(process.stdout.rows),
	String(process.stdin.isRaw),
	typeof process.stdin.setRawMode,
]));`;

/**
 * The TTY shim has to fire under mintty and nowhere else: firing in a real console would
 * replace its size, and staying inert under mintty is the black window. `stty` is absent
 * here, so the size falls back to COLUMNS/LINES, which keeps the cases meaningful.
 */
const TTY_CASES = [
	{
		what: "presents the mintty pty as a TTY sized from COLUMNS/LINES, with raw mode",
		preload: `Object.defineProperty(process, "platform", { value: "win32" });
process.env.TERM_PROGRAM = "mintty";
process.env.COLUMNS = "100";
process.env.LINES = "28";
`,
		expected: ["true", "100", "28", "false", "function"],
	},
	{
		what: "leaves a real console's size and stdin alone",
		preload: `Object.defineProperty(process, "platform", { value: "win32" });
for (const [name, value] of [["isTTY", true], ["columns", 90], ["rows", 30]]) {
	Object.defineProperty(process.stdout, name, { value, configurable: true, writable: true });
}
`,
		expected: ["true", "90", "30", "undefined", "undefined"],
	},
	{
		what: "stays out of the way when the output is redirected",
		preload: `Object.defineProperty(process, "platform", { value: "win32" });
`,
		expected: ["undefined", "undefined", "undefined", "undefined", "undefined"],
	},
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

/** The shim source in the package, or "" when the file is missing. */
function source(shim) {
	const path = join(dir, shim);
	return existsSync(path) ? readFileSync(path, "utf8") : "";
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

	// pi.bat is the only entry point a user runs, so it must load every shim of the
	// console path, and the launcher must load the two mintty ones by exact filename: a
	// typo there is a black mintty window that no CI machine can show.
	const launcher = source("pi.bat");
	for (const shim of PI_BAT_SHIMS) {
		check(`pi.bat loads ${shim}`, launcher.includes(`--require "%ROOT%${shim}"`));
	}
	const mintty = source("win7-mintty-launch.cjs");
	for (const shim of ["win7-mintty-probe.cjs", "win7-mintty-tty.cjs"]) {
		check(`the mintty launcher loads ${shim}`, mintty.includes(`"${shim}"`));
	}
	check("the mintty launcher starts mintty", mintty.includes('"mintty.exe"'));

	// Without a CLI path there is nothing to start, and the launcher must say so instead
	// of falling through to the probe timeout, which would cost the user eight seconds.
	const started = spawnSync(node, [resolve(dir, "win7-mintty-launch.cjs")], { encoding: "utf8" });
	check("the mintty launcher rejects a missing CLI path", started.status === 2, `exit ${started.status}`);

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

	for (const { what, preload, expected } of TTY_CASES) {
		let got;
		try {
			got = probe(preload, "win7-mintty-tty.cjs", TTY_STATE);
		} catch (error) {
			check(`mintty TTY shim ${what}`, false, reason(error));
			continue;
		}
		const actual = JSON.parse(got);
		check(
			`mintty TTY shim ${what}`,
			JSON.stringify(actual) === JSON.stringify(expected),
			JSON.stringify(actual) === JSON.stringify(expected) ? "" : `got ${got}, want ${JSON.stringify(expected)}`,
		);
	}

	// The probe file is how the launcher learns mintty really ran Pi, so the shim clearing
	// it is the one thing that must work. Against a copy: the package directory may be
	// read-only, and it must not gain a stray file.
	if (source("win7-mintty-probe.cjs")) {
		const probeDir = join(temporary, "probe");
		mkdirSync(probeDir, { recursive: true });
		copyFileSync(join(dir, "win7-mintty-probe.cjs"), join(probeDir, "win7-mintty-probe.cjs"));
		const probeFile = join(probeDir, "win7-mintty-probe.tmp");
		writeFileSync(probeFile, "probe\n");
		execFileSync(node, ["--require", join(probeDir, "win7-mintty-probe.cjs"), "-e", ""]);
		check("the mintty probe shim clears the probe file", !existsSync(probeFile));
	}
} finally {
	rmSync(temporary, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
