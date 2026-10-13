// Windows 7's console has no VT support. Node's libuv translates *basic* ANSI SGR
// codes (30-37, 40-47, 90-97, 100-107, 39, 49) into console attributes, but it
// mishandles the extended forms: `38;5;N` lands on a wrong attribute and
// `38;2;r;g;b` is dropped entirely (measured with ReadConsoleOutputAttribute on
// Windows 7 SP1: 31m -> 0x04 red, 38;5;196m -> 0x87, 38;2;255;0;0m -> 0x07 grey).
//
// Pi detects every win32 console as truecolor, so a stock run paints the TUI with
// 24-bit colour this console cannot show: most colours vanish, some turn into inverse
// text, and the interface looks broken. This shim rewrites every extended SGR emitted
// through process.stdout into the nearest of the 16 colours the console actually has.
//
// Loaded with `node --require`, so it only affects the console path: mintty is a real
// pty and must not load it. Set PI_WIN7_ANSI16=0 to disable.
if (process.platform === "win32" && process.stdout.isTTY && process.env.PI_WIN7_ANSI16 !== "0") {
	const PALETTE = [
		[0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
		[0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
		[128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
		[0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
	];
	const CUBE = [0, 95, 135, 175, 215, 255];
	const SGR = /\x1b\[([0-9;]*)m/g;

	// Weighted for the eye (green dominates), which maps visibly closer than a plain
	// euclidean distance would.
	function nearest16(r, g, b) {
		let best = 0;
		let bestDistance = Infinity;
		for (let i = 0; i < 16; i++) {
			const [pr, pg, pb] = PALETTE[i];
			const distance =
				(r - pr) * (r - pr) * 0.299 +
				(g - pg) * (g - pg) * 0.587 +
				(b - pb) * (b - pb) * 0.114;
			if (distance < bestDistance) {
				bestDistance = distance;
				best = i;
			}
		}
		return best;
	}

	function indexToRgb(index) {
		if (index < 16) return PALETTE[index];
		if (index < 232) {
			const cube = index - 16;
			return [CUBE[Math.floor(cube / 36)], CUBE[Math.floor((cube % 36) / 6)], CUBE[cube % 6]];
		}
		const gray = 8 + (index - 232) * 10;
		return [gray, gray, gray];
	}

	function toBasicColor(index, background) {
		if (background) return index < 8 ? 40 + index : 100 + index - 8;
		return index < 8 ? 30 + index : 90 + index - 8;
	}

	function convertSgr(parameters) {
		const tokens = parameters.length === 0 ? [] : parameters.split(";");
		const output = [];
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i] === "" ? "0" : tokens[i];
			if (token === "38" || token === "48") {
				const background = token === "48";
				const mode = tokens[i + 1];
				if (mode === "5" && tokens[i + 2] !== undefined) {
					const index = Number(tokens[i + 2]);
					const basic = index < 16 ? index : nearest16(...indexToRgb(index));
					output.push(String(toBasicColor(basic, background)));
					i += 2;
					continue;
				}
				if (mode === "2" && tokens[i + 4] !== undefined) {
					const rgb = [Number(tokens[i + 2]), Number(tokens[i + 3]), Number(tokens[i + 4])];
					output.push(String(toBasicColor(nearest16(rgb[0], rgb[1], rgb[2]), background)));
					i += 4;
					continue;
				}
			}
			output.push(token);
		}
		return `\x1b[${output.join(";")}m`;
	}

	function transform(text) {
		// Fast path: the TUI writes many plain frames, so only pay for the regex when an
		// extended colour could be in the text at all.
		if (text.indexOf("\x1b[") === -1) return text;
		if (text.indexOf(";5;") === -1 && text.indexOf(";2;") === -1) return text;
		return text.replace(SGR, (sequence, parameters) =>
			parameters.indexOf("38;") === -1 && parameters.indexOf("48;") === -1
				? sequence
				: convertSgr(parameters),
		);
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
