// A Chinese (936), Japanese (932), Korean (949, 1361) or Traditional (950) console code
// page makes the console draw East Asian "ambiguous width" characters with a CJK font
// while Pi, following Unicode's East Asian Width, counts each as one column. On Windows 7
// the console also advances the cursor a full cell per glyph, so every box-drawing border
// Pi lays out as N columns occupies 2N and the frame wraps: a row of 100 U+2500 came back
// as 60 on one screen row and 40 on the next. Windows 10 conhost keeps the cursor at one
// cell but still takes the glyph from the CJK font: 新宋体 at 8x16 draws U+2500 16 pixels
// wide in an 8-pixel cell (measured on 10.0.17763, U+2580 11 px, U+2713 15 px), so the
// right half is clipped instead. Borders break into dashes, blocks lose half their face
// and the logo smears; either way the frame is unreadable.
//
// The obvious fix -- switch the console to the single-byte Latin code page 437 -- is
// wrong: it makes the borders narrow but the console can then no longer show Chinese at
// all ("中文测试" came back as "????"), and Windows 7's UTF-8 code page (65001) draws
// nothing. Neither is an option, which is why no code-page shim ships.
//
// This shim leaves the code page alone (so Chinese keeps displaying and IME input keeps
// working) and rewrites the glyphs Pi draws with ASCII: borders to + - |, blocks to #,
// bullets to *, arrows to < > ^ v, and the few status icons the CJK font also draws too
// wide (⊘ ⊞ ⊟) to x + -. The output then fits the columns Pi reserved for it, so the
// input box and footer land where Pi intends.
//
// The starter header's logo cannot be mapped to ASCII and is redrawn instead. It is
// half-block art -- "▀▀█" over "█▀ █", four cells wide and two rows tall -- that only
// reads as a pi when every glyph fills exactly one cell and touches the row below it.
// Wrapped over eight columns on Windows 7, or clipped to half-glyphs on Windows 10, it
// keeps neither the shape nor the columns.
//
// So the glyphs are replaced by the same logo painted with cell backgrounds. A space is
// one cell in every font and every code page, and a background colour fills the whole
// cell rectangle whatever the font does with "ambiguous width" glyphs, so the logo keeps
// its shape, its colours and its columns without depending on a single glyph. The version
// and the key hints stay where Pi put them, and the wordmark Pi uses on Apple Terminal is
// not needed here.
//
// The art is four columns by four *half* rows (the grid the 3D easter egg spells out as
// "ccc.", "b.c.", "bb.y", "b..y"). A cell holds one background colour, so four half rows
// cannot become two cell rows of pixels. Pi reserves exactly two rows and four columns for
// the art, and the default paint keeps that footprint by taking the top half of each pair:
//
//     q1+q2  coral coral coral  .   -> the row with the version
//     q3+q4  blue  blue   .  yellow -> the row with the key hints
//
// What it costs is q2: the blue bottom half of the first cell, the pixel where the blue
// stem starts under the coral bar. That single half cell cannot be painted at all, because
// the cell it lives in belongs to q1 (coral). Everything else -- the length of the bar, the
// width of the stem and of the foot, the yellow dot on the hint row -- lands where the art
// puts it, and the logo keeps the native two rows, so the version and the hints stay on
// their native rows too.
//
// PI_WIN7_LOGO=tall buys that half cell back by painting q1 on the blank row Pi leaves
// above its header (via a relative cursor move that also restores the cursor, because Pi
// writes the version straight after the art) and putting q2 and q3 on the two reserved
// rows. It is off by default: at one colour per whole cell the gap in q2 reads as a hole
// between the stem and the coral corner, and the logo grows a row, which moves the version
// text off the line the art is drawn on. When the art is on the first screen row there is
// no row above it and the tall paint falls back to the default one.
//
// The colours are the brand constants from pi-logo.js. Below Windows 10 the colour shim
// runs *outside* this one (it is required after this file, so it sees the stream first),
// which means codes added here would bypass its true-colour downgrade; that tier therefore
// gets the nearest of the 16 colours the console has, and Windows 10 and later the 24-bit
// values.
//
// Loaded with `node --require` on the console path only; mintty is a real pty with a
// single-cell font and must not load it. Set PI_WIN7_BOXASCII=0 to disable.
//
// Below Windows 10 the console has no VT support, so this belongs to the older console
// unconditionally. Windows 10 and later draw box drawing and blocks themselves, but their
// font still follows the code page, so a CJK console there is just as unreadable (clipped
// instead of wrapped) and gets the rewrite too; a Latin console (437, 850, 65001) uses a
// Latin font and leaves the frame alone. PI_WIN7_CONSOLE_SHIMS=1/0 forces the tier on/off,
// and PI_WIN7_CONSOLE_CODEPAGE=936 skips the chcp probe.
//
// A terminal that draws the screen itself -- Windows Terminal, VS Code's integrated
// terminal, WezTerm, mintty -- uses its own font instead of the console's code-page font,
// so the frame already fits and the rewrite only costs the real logo. Those terminals are
// detected through WT_SESSION / TERM_PROGRAM and skipped. Windows Terminal's
// default-terminal handoff does not put WT_SESSION into the child's environment, so that
// case still takes the conservative rewrite.
const os = require("node:os");
const { execFileSync } = require("node:child_process");

// Code pages whose console selects a CJK font that draws East Asian "ambiguous width"
// characters wider than one cell.
const DOUBLE_BYTE_CODE_PAGES = [932, 936, 949, 950, 1361];

// Terminals that render the screen with their own font rather than conhost's. Their glyph
// widths do not follow the code page, so the code-page rewrite below does not apply to them.
const SELF_RENDERING_TERMINAL = /^(vscode|windows_terminal|wezterm|ghostty|alacritty|zed|mintty)$/i;

// chcp.com prints the code page its console runs on. The digits are ASCII in every code
// page the console can be set to, so a latin1 decode is enough to read the number back.
// It costs a few dozen milliseconds once per start, and it is the only way to ask the
// console for its code page from Node: GetConsoleOutputCP is not exposed to JavaScript.
function consoleCodePage() {
	const configured = Number(process.env.PI_WIN7_CONSOLE_CODEPAGE);
	if (Number.isInteger(configured) && configured > 0) return configured;
	try {
		const output = execFileSync("chcp.com", [], { encoding: "latin1", timeout: 5000, windowsHide: true });
		const match = /(\d{3,5})/.exec(output);
		return match === null ? 0 : Number(match[1]);
	} catch {
		// No console, no chcp or an unreadable reply: leave the frame alone rather than
		// rewrite glyphs that may well be fine.
		return 0;
	}
}

const FORCED = process.env.PI_WIN7_CONSOLE_SHIMS;
const OLD_CONSOLE = FORCED === "1" || (FORCED !== "0" && Number(os.release().split(".")[0]) < 10);

if (process.platform !== "win32" || FORCED === "0") return;
// Checked before the code page probe: under mintty stdout is not a TTY yet (the mintty
// shim runs after this one), and a redirected stdout never needs any of this.
if (!process.stdout.isTTY || process.env.PI_WIN7_BOXASCII === "0") return;
// A self-rendering terminal has its own font, so the code page no longer decides the glyph
// width. Skipping saves the chcp probe as well as the logo.
if (process.env.WT_SESSION || SELF_RENDERING_TERMINAL.test(process.env.TERM_PROGRAM ?? "")) return;
if (!OLD_CONSOLE && !DOUBLE_BYTE_CODE_PAGES.includes(consoleCodePage())) return;

{
	// Everything this shim rewrites. AMBIGUOUS is global so replace() rewrites every
	// match; HAS_AMBIGUOUS is a separate stateless copy for the fast path, because a
	// /g regex carries lastIndex between calls.
	const AMBIGUOUS_PATTERN =
		"[\\u00b7\\u2010-\\u2027\\u2039\\u203a\\u2190-\\u21ff\\u2298\\u229e\\u229f\\u2500-\\u25ff\\u2713-\\u2718\\u276e\\u276f]";
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
			// ↳ is the queued-message hint and this font draws it 7 px wide, inside the cell.
			if (code === 0x21b3) return null;
			if (code === 0x2190 || code === 0x21d0) return "<";
			if (code === 0x2192 || code === 0x21d2) return ">";
			if (code === 0x2191 || code === 0x21d1) return "^";
			if (code === 0x2193 || code === 0x21d3) return "v";
			if (code === 0x2194 || code === 0x21d4) return "-";
			if (code === 0x2195 || code === 0x21d5) return "|";
			return "*";
		}
		// Technical symbols the interface uses as status icons. They are not "ambiguous"
		// in Unicode, but this font draws them 10 to 15 px wide, so the console clips them
		// inside the one cell Pi reserved: ⊘ cancelled, ⊞ folded, ⊟ open.
		if (code === 0x2298) return "x";
		if (code === 0x229e) return "+";
		if (code === 0x229f) return "-";
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

	// Any SGR sequence, whatever colour mode the theme reports: this console gets 16
	// colours (win7-ansi16.cjs) and a mintty-free Windows 10 gets 24-bit ones.
	const SGR = "\\x1b\\[[0-9;]*m";
	const RESET = "\x1b[0m";

	// The logo's brand colours (pi-logo.js keeps them fixed across themes), as cell
	// backgrounds rather than foregrounds. Below Windows 10 the console only has 16
	// colours and libuv drops 24-bit SGR, so that tier uses bright red, blue and bright
	// yellow, the closest it can get to coral, blue and yellow.
	const LOGO_COLORS = OLD_CONSOLE
		? { coral: "\x1b[101m", blue: "\x1b[44m", yellow: "\x1b[103m" }
		: { coral: "\x1b[48;2;228;138;122m", blue: "\x1b[48;2;79;142;179m", yellow: "\x1b[48;2;234;182;93m" };

	// The two rows of the logo are matched separately, so it does not matter whether Pi
	// writes them in one frame or in two chunks: the first paint places each row with its
	// own absolute cursor move ("\x1b[2;1H\x1b[2K <top>", "\x1b[3;1H\x1b[2K <bottom>") and a
	// repaint that scrolls separates them with "\r\n".
	//
	//   top:    <blue bg><coral>▀<reset><coral>▀█<reset> " "
	//   bottom: <blue>█▀<reset> " " <yellow>█<reset> " "
	//
	// Each pattern consumes its row's glyphs and the space after them, four or five columns
	// in all, and the replacement occupies exactly the same columns. Everything around the
	// glyphs -- the indent, the clear-line, the version and the key hints -- is left alone.
	// Both are global: one write can carry more than one frame.
	const TOP_ART = new RegExp(`(?:${SGR})*▀(?:${SGR})+▀█(?:${SGR})* `, "g");
	const BOTTOM_ART = new RegExp(`(?:${SGR})*█▀(?:${SGR})* (?:${SGR})+█(?:${SGR})* `, "g");

	// The screen row the art is on, when the chunk says so: the frame Pi writes positions
	// every line with "\x1b[<row>;<col>H", so the row is the last such move before the art.
	// A chunk that reaches the art through a "\n" instead leaves the row unknown (-1) and
	// the last known answer stands.
	const ABSOLUTE_ROW = /\x1b\[(\d+)(?:;\d+)?H/g;
	function rowBefore(text, offset) {
		let row = -1;
		let end = -1;
		ABSOLUTE_ROW.lastIndex = 0;
		for (let match = ABSOLUTE_ROW.exec(text); match !== null; match = ABSOLUTE_ROW.exec(text)) {
			if (match.index >= offset) break;
			row = Number(match[1]);
			end = ABSOLUTE_ROW.lastIndex;
		}
		if (row === -1 || text.slice(end, offset).includes("\n")) return -1;
		return row;
	}

	// Tall paint (PI_WIN7_LOGO=tall): whether the coral bar has a row of its own above the
	// header. Decided by the first sighting and kept, so the logo does not change shape
	// halfway through a session; a sighting on the first screen row always answers no,
	// because there is nothing above it.
	const TALL = process.env.PI_WIN7_LOGO === "tall";
	let logoHasTopRow = true;

	function replaceLogo(text) {
		if (text.indexOf("▀") === -1) return text;
		const { coral, blue, yellow } = LOGO_COLORS;
		// Four cells per row, exactly the art's width. Cells with no colour are left as the
		// console's own background, so the logo reads the same on a black console and on any
		// other background colour.
		const cell = (colour) => (colour === null ? " " : `${colour} ${RESET}`);
		const bar = cell(coral) + cell(coral) + cell(coral) + cell(null);
		const stem = cell(blue) + cell(null) + cell(coral) + cell(null);
		const foot = cell(blue) + cell(blue) + cell(null) + cell(yellow);
		text = text.replace(TOP_ART, (match, offset) => {
			if (!TALL) return bar;
			const row = rowBefore(text, offset);
			if (row !== -1) logoHasTopRow = row >= 2;
			if (!logoHasTopRow) return bar;
			// Draw the coral bar on the row above, then come back down with the cursor exactly
			// where the art left it -- five columns back, one blank cell, the stem row -- so the
			// version Pi writes next does not move.
			return `\x1b[1A${bar}\x1b[1B\x1b[5D ${stem}`;
		});
		return text.replace(BOTTOM_ART, () => `${foot} `);
	}

	function transform(text) {
		// The logo goes first: it is half blocks, and running the mapping over it would turn
		// its art into a row of "#" before the logo could be recognised.
		if (text.indexOf("▀") !== -1) text = replaceLogo(text);
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
