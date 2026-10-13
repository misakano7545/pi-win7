// Marks that the interactive Pi process really started under mintty. pi.bat creates
// win7-mintty-probe.tmp before it launches mintty and checks for it after mintty
// exits. mintty can exit 0 without ever starting its child; without the check pi.bat
// would silently do nothing in that environment instead of falling back to the
// console.
//
// Loaded with `node --require` on the mintty path only. It deletes the probe file and
// otherwise stays out of the way: unlike the three console shims it must not touch the
// terminal, because mintty is a real pty.
const fs = require("node:fs");
const path = require("node:path");

try {
	fs.unlinkSync(path.join(__dirname, "win7-mintty-probe.tmp"));
} catch {
	// Missing means there was nothing to clear (or pi.bat could not create it).
}
