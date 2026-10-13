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
// Node exposes the console size as an *instance data property* of process.stdout
// (WriteStream assigns `this.columns = w` from its window-size callback), not as a
// getter. An earlier version of this shim only patched getters, so it silently did
// nothing at all -- Node kept reporting the full console size and Pi kept touching
// both edges, which is why the garble survived. Both forms are handled below, and
// the data-property form keeps a setter so Node's own resize writes still land.
//
// Loaded with `node --require`, so argv and module resolution stay untouched.
//
// Not gated on the console version, unlike the colour and glyph shims: this is the one
// whose symptom -- the frame drawn a row out of place, so the input box is overwritten --
// came back on a Windows 11 console with the shim switched off, and conhost scrolls on the
// last cell on both. Windows Terminal, which defers the wrap the way xterm does, only pays
// a blank column and row. Set PI_WIN7_TTY_WIDTH=0 to disable.
if (process.platform !== "win32" || process.env.PI_WIN7_TTY_WIDTH === "0") return;
for (const property of ["columns", "rows"]) {
	let target = process.stdout;
	let descriptor;
	while (target && !(descriptor = Object.getOwnPropertyDescriptor(target, property))) {
		target = Object.getPrototypeOf(target);
	}
	if (!descriptor) continue;

	const adjust = (value) => (typeof value === "number" && value > 1 ? value - 1 : value);

	if (descriptor.get) {
		// Accessor form: delegate to the original getter, and keep its setter if it has one.
		Object.defineProperty(process.stdout, property, {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				return adjust(descriptor.get.call(this));
			},
			set: descriptor.set,
		});
	} else {
		// Data-property form: hold whatever Node writes in `stored`.
		let stored = descriptor.value;
		Object.defineProperty(process.stdout, property, {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				return adjust(stored);
			},
			set(value) {
				stored = value;
			},
		});
	}
}
