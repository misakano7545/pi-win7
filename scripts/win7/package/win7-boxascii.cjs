// A Chinese (936), Japanese (932), Korean (949) or Traditional (950) console code page
// makes the Windows console render East Asian "ambiguous width" characters as
// full-width. Pi treats them as one column (they are not Wide in Unicode), so every
// box-drawing border Pi lays out as N columns actually occupies 2N and the frame wraps:
// the input box turns into a block of horizontal lines and the footer and status rows
// shift down. Measured on Windows 7 SP1 with code page 936: a row of 100 U+2500 came
// back as 60 on one screen row and 40 on the next.
//
// The obvious fix -- switch the console to the single-byte Latin code page 437 -- is
// wrong: it makes the borders narrow but the console can then no longer show Chinese at
// all ("中文测试" came back as "????"), and Windows 7's UTF-8 code page (65001) draws
// nothing. Neither is an option, which is why no code-page shim ships.
//
// This shim leaves the code page alone (so Chinese keeps displaying and IME input keeps
// working) and rewrites the ambiguous-width glyphs Pi draws into one-column ASCII:
// borders to + - |, blocks to #, bullets to *, arrows to < > ^ v. The output then stays
// inside the columns Pi reserved for it, so the input box and footer land where Pi
// intends.
//
// Loaded with `node --require` on the console path only; mintty is a real pty with a
// single-cell font and must not load it. Set PI_WIN7_BOXASCII=0 to disable.
//
// Windows 10 and later draw box drawing properly, so this belongs to the older console.
// PI_WIN7_CONSOLE_SHIMS=1/0 forces the tier on/off.
const OLD_CONSOLE =
	process.env.PI_WIN7_CONSOLE_SHIMS === "1" ||
	(process.env.PI_WIN7_CONSOLE_SHIMS !== "0" &&
		Number(require("node:os").release().split(".")[0]) < 10);
if (process.platform !== "win32" || !OLD_CONSOLE) return;
if (process.stdout.isTTY && process.env.PI_WIN7_BOXASCII !== "0") {
	// Everything this shim rewrites. AMBIGUOUS is global so replace() rewrites every
	// match; HAS_AMBIGUOUS is a separate stateless copy for the fast path, because a
	// /g regex carries lastIndex between calls.
	const AMBIGUOUS_PATTERN = "[\\u00b7\\u2010-\\u2027\\u2039\\u203a\\u2190-\\u21ff\\u2500-\\u25ff\\u2713-\\u2718\\u276e\\u276f]";
	const AMBIGUOUS = new RegExp(AMBIGUOUS_PATTERN, "g");
	const HAS_AMBIGUOUS = new RegExp(AMBIGUOUS_PATTERN);

	function mapCodePoint(code) {
		// Box Drawing U+2500..U+257F: light/heavy/double lines, corners, tees.
		if (code >= 0x2500 && code <= 0x257f) {
			if (code === 0x2571) return "/";
			if (code === 0x2572) return "\\";
			if (code === 0x2573) return "X";
			if (code === 0x2500 || code === 0x2504 || code === 0x2508 || code === 0x254c || code === 0x254d) return "-";
			if (code === 0x2501 || code === 0x2505 || code === 0x2509 || code === 0x254e || code === 0x254f) return "=";
			if (code === 0x2502 || code === 0x2503 || code === 0x2506 || code === 0x2507 || code === 0x250a || code === 0x250b) return "|";
			return "+";
		}
		// Block Elements U+2580..U+259F: used for cursors, scrollbars, progress.
		if (code >= 0x2580 && code <= 0x259f) return "#";
		// Geometric Shapes U+25A0..U+25FF.
		if (code >= 0x25a0 && code <= 0x25ff) {
			if (code === 0x25b2 || code === 0x25b3 || code === 0x25b4 || code === 0x25b5) return "^";
			if (code >= 0x25b6 && code <= 0x25bb) return ">";
			if (code === 0x25bc || code === 0x25bd || code === 0x25be || code === 0x25bf) return "v";
			if (code >= 0x25c0 && code <= 0x25c5) return "<";
			if (code === 0x25a0 || code === 0x25a1 || code === 0x25aa || code === 0x25ab || code === 0x25fb || code === 0x25fc) return "#";
			if (code === 0x25cb || code === 0x25cf || code === 0x25e6 || code === 0x25ef || code === 0x25ce || code === 0x25cc) return "o";
			return "*";
		}
		// Arrows U+2190..U+21FF.
		if (code >= 0x2190 && code <= 0x21ff) {
			if (code === 0x2190 || code === 0x21d0) return "<";
			if (code === 0x2192 || code === 0x21d2) return ">";
			if (code === 0x2191 || code === 0x21d1) return "^";
			if (code === 0x2193 || code === 0x21d3) return "v";
			if (code === 0x2194 || code === 0x21d4) return "-";
			if (code === 0x2195 || code === 0x21d5) return "|";
			return "*";
		}
		// Punctuation and marks.
		if (code === 0x2022 || code === 0x2023) return "*";
		if (code === 0x2026) return ".";
		if (code === 0x2018 || code === 0x2019) return "'";
		if (code === 0x201c || code === 0x201d) return "\"";
		if (code >= 0x2010 && code <= 0x2015) return "-";
		if (code === 0x2020 || code === 0x2021) return "+";
		if (code === 0x2039) return "<";
		if (code === 0x203a) return ">";
		if (code === 0x276e) return "<";
		if (code === 0x276f) return ">";
		if (code === 0x2713 || code === 0x2714) return "v";
		if (code === 0x2715 || code === 0x2716 || code === 0x2717 || code === 0x2718) return "x";
		if (code === 0x00b7) return ".";
		return null;
	}

	function transform(text) {
		if (!HAS_AMBIGUOUS.test(text)) return text;
		return text.replace(AMBIGUOUS, (character) => {
			const replacement = mapCodePoint(character.codePointAt(0));
			return replacement === null ? character : replacement;
		});
	}

	const originalWrite = process.stdout.write;
	process.stdout.write = function write(chunk, encoding, callback) {
		if (typeof encoding === "function") {
			callback = encoding;
			encoding = undefined;
		}
		if (typeof chunk === "string") {
			chunk = transform(chunk);
		} else if (Buffer.isBuffer(chunk) && chunk.length > 0) {
			const text = chunk.toString("utf8");
			const converted = transform(text);
			if (converted !== text) chunk = Buffer.from(converted, "utf8");
		}
		return originalWrite.call(process.stdout, chunk, encoding, callback);
	};
}
