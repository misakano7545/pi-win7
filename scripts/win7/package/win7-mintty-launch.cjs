// Starts the interactive TUI in mintty and reports whether it really started.
//
// pi.bat uses this helper instead of launching mintty itself for two reasons:
//
//  1. The Windows 7 console never reports mouse events to a Node process (only key
//     events reach stdin) and ignores the xterm mouse modes Pi enables, so the mouse
//     wheel cannot scroll the transcript there. mintty is a real pty and can.
//
//  2. mintty returns immediately: its real window is a separate process, so neither
//     `start /wait` nor waiting on the mintty process can tell whether Pi ever ran.
//     mintty can exit 0 without starting its child, which would leave pi.bat silently
//     doing nothing instead of falling back to the console.
//
// The helper writes win7-mintty-probe.tmp, starts mintty with win7-mintty-probe.cjs
// and win7-mintty-tty.cjs loaded, and waits for the probe shim to delete the probe.
// The probe surviving the timeout means mintty failed before Pi started; the helper
// then exits 1 so pi.bat can fall back. On success it exits 0 and the detached mintty
// window keeps running Pi.
//
// The console shims are deliberately not loaded: mintty is a real pty. The TTY shim
// is loaded because native Windows Node sees that pty as a pair of named pipes; it is
// what makes Pi start in interactive mode instead of waiting for piped input forever.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const cliPath = process.argv[2];
if (!cliPath) {
	console.error("[mintty] missing the Pi CLI path");
	process.exit(2);
}

const probePath = path.join(__dirname, "win7-mintty-probe.tmp");
const probeShim = path.join(__dirname, "win7-mintty-probe.cjs");
const ttyShim = path.join(__dirname, "win7-mintty-tty.cjs");
const minttyPath = path.join(__dirname, "git", "usr", "bin", "mintty.exe");
// Generous: antivirus scanning node.exe on first launch can delay startup, and the
// wait only runs to the end on the machine where mintty is broken anyway.
const START_TIMEOUT_MS = 8000;

// A read-only package folder cannot hold the probe file. Then start mintty anyway
// and trust it, which is the best this helper can do without a probe.
let probeWritable = true;
try {
	fs.writeFileSync(probePath, "probe\n");
} catch {
	probeWritable = false;
}

const child = spawn(
	minttyPath,
	["-s", "120,34", process.execPath, "--require", probeShim, "--require", ttyShim, cliPath],
	{
		detached: true,
		stdio: "ignore",
		windowsHide: false,
	},
);
// A spawn failure must not crash the helper; the probe timeout below falls back.
child.on("error", () => {});
child.unref();

function waitForStart() {
	if (!probeWritable || !fs.existsSync(probePath)) process.exit(0);
	if (Date.now() >= deadline) {
		try {
			fs.unlinkSync(probePath);
		} catch {
			// Nothing to clean up.
		}
		process.exit(1);
	}
	setTimeout(waitForStart, 100);
}

const deadline = Date.now() + START_TIMEOUT_MS;
waitForStart();
