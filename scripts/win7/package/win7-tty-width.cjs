// Windows 7's console wraps the moment a line's last cell is written, where xterm
// defers that wrap until the next character arrives. Pi lays out its frame assuming
// the xterm behaviour, so one full-width line scrolls the screen and every frame
// after it is a row out of place: the top line loses a character, the footer is
// drawn twice, and typing appears to add a line of its own.
//
// Reporting one column less keeps Pi off the last cell for good, at the cost of one
// blank column at the right edge. The alt screen tries the same thing with
// "\x1b[?7l", which this console ignores.
//
// Loaded with `node --require`, so argv and module resolution stay untouched.
let target = process.stdout;
let descriptor;
while (target && !(descriptor = Object.getOwnPropertyDescriptor(target, "columns"))) {
	target = Object.getPrototypeOf(target);
}
if (descriptor?.get) {
	Object.defineProperty(process.stdout, "columns", {
		configurable: true,
		get() {
			const width = descriptor.get.call(this);
			return typeof width === "number" && width > 1 ? width - 1 : width;
		},
	});
}
