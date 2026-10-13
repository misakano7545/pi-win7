// Windows 7's console wraps and scrolls the moment the last cell or the last row is
// written, where xterm defers that until the next character arrives. Pi lays out its
// frame assuming the xterm behaviour, so a full-width line scrolls the screen and
// every frame after it is a row out of place: the top line loses a character, the
// footer is drawn twice, typed text appears to add a line, and the input box at the
// bottom of the screen grows an extra row.
//
// Reporting one less column and one less row keeps Pi off both edges for good, at the
// cost of a blank column and a blank row. The alt screen tries the same thing for
// columns with "\x1b[?7l", which this console ignores.
//
// Loaded with `node --require`, so argv and module resolution stay untouched.
for (const property of ["columns", "rows"]) {
	let target = process.stdout;
	let descriptor;
	while (target && !(descriptor = Object.getOwnPropertyDescriptor(target, property))) {
		target = Object.getPrototypeOf(target);
	}
	if (!descriptor?.get) continue;
	Object.defineProperty(process.stdout, property, {
		configurable: true,
		get() {
			const size = descriptor.get.call(this);
			return typeof size === "number" && size > 1 ? size - 1 : size;
		},
	});
}
