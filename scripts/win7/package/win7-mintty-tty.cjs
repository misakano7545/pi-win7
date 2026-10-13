// mintty is an MSYS pty, so the native Windows Node runtime sees stdin and stdout as
// named pipes: isTTY is undefined and setRawMode does not exist. Pi then classifies the
// run as non-interactive and waits for piped input that never comes, which is the black
// mintty window with no interface.
//
// This shim presents the pty as a TTY: it sets isTTY, reports the real pty size (read
// from MSYS stty, which still recognises the pty through the inherited handle), switches
// the pty to raw input (without this the pty line discipline buffers everything until a
// newline, so keystrokes and mouse reports never reach Pi), provides setRawMode through
// stty, and emits resize events when the window changes size, so Pi reflows instead of
// wrapping.
//
// It activates only for mintty (TERM_PROGRAM=mintty) and never when stdout is a
// redirected file, so non-interactive use keeps working. Loaded with `node --require`:
// on the mintty path it is the only shim; on the console path it loads last, after the
// three console shims, which see the real state under mintty and do nothing there.
const { spawn, spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const STTY = path.join(__dirname, "git", "usr", "bin", "stty.exe");
// MSYS programs write *.stackdump into the working directory on a fatal error; when a
// poll races the terminal closing, that must not litter the user's project.
const STTY_CWD = os.tmpdir();
const RESIZE_POLL_MS = 1000;

function parseSize(text) {
	const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(String(text ?? ""));
	if (!match) return undefined;
	const rows = Number(match[1]);
	const columns = Number(match[2]);
	return rows > 0 && columns > 0 ? { columns, rows } : undefined;
}

function readSizeSync() {
	try {
		const result = spawnSync(STTY, ["size"], {
			stdio: ["inherit", "pipe", "ignore"],
			windowsHide: true,
			cwd: STTY_CWD,
			timeout: 2000,
		});
		return result.status === 0 ? parseSize(result.stdout?.toString()) : undefined;
	} catch {
		return undefined;
	}
}

function setPtyRaw(enabled) {
	try {
		spawnSync(STTY, enabled ? ["raw", "-echo"] : ["sane"], {
			stdio: ["inherit", "ignore", "ignore"],
			windowsHide: true,
			cwd: STTY_CWD,
			timeout: 2000,
		});
	} catch {
		// Best effort: stty may be missing; Pi still starts, just with line buffering.
	}
}

if (
	process.platform === "win32" &&
	process.stdout.isTTY !== true &&
	process.env.TERM_PROGRAM === "mintty"
) {
	let size = readSizeSync() ?? {
		columns: Number(process.env.COLUMNS) > 0 ? Number(process.env.COLUMNS) : 80,
		rows: Number(process.env.LINES) > 0 ? Number(process.env.LINES) : 24,
	};

	function define(object, property, value) {
		try {
			Object.defineProperty(object, property, { value, configurable: true, writable: true });
		} catch {
			// If a future Node makes the property non-configurable, Pi still has COLUMNS/LINES.
		}
	}

	define(process.stdout, "isTTY", true);
	define(process.stdin, "isTTY", true);
	define(process.stdout, "columns", size.columns);
	define(process.stdout, "rows", size.rows);
	define(process.stdin, "setRawMode", setPtyRaw);
	if (process.stdin.isRaw === undefined) define(process.stdin, "isRaw", false);

	// Pi calls setRawMode(true) on start; doing it here as well guarantees the pty is
	// raw before the first key or mouse report can arrive.
	setPtyRaw(true);

	function pollSize() {
		const child = spawn(STTY, ["size"], {
			stdio: ["inherit", "pipe", "ignore"],
			windowsHide: true,
			cwd: STTY_CWD,
		});
		let output = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.on("error", () => {});
		child.on("close", () => {
			const current = parseSize(output);
			if (!current || (current.columns === size.columns && current.rows === size.rows)) return;
			size = current;
			define(process.stdout, "columns", current.columns);
			define(process.stdout, "rows", current.rows);
			process.stdout.emit("resize");
		});
	}

	// unref: the poll must never keep Node alive on its own.
	setInterval(pollSize, RESIZE_POLL_MS).unref();
}
