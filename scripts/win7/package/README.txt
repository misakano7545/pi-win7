Pi for Windows 7 - portable package
===================================

What this is
------------
A complete, self-contained Pi for Windows 7 SP1 x64. Unzip anywhere (USB stick,
Desktop, C:\pi) and run. No installer, no registry, no npm, no network needed on
first start.

    pi-win7-x64/
      pi.bat      <-- run this (the entry point, where pi.exe sits in the official zip)
      node/       Windows 7-compatible Node.js runtime
      git/        portable Git for Windows: bash for Pi's bash tool, mintty as terminal
      pi/         the Pi program tree
      agent/      your data: settings, sessions, credentials, extensions
      agent/bin/  rg.exe + fd.exe, pinned to the last Windows 7-compatible builds

How to start
------------
1. Run pi.bat. That is the whole procedure: nothing to install first, no admin
   rights, no registry. Pi starts in the bundled mintty terminal.
2. First run: /login to connect a provider, then /model to pick a model.

An interactive start opens Pi in git\usr\bin\mintty.exe, the bundled terminal. Two
Windows 7 console limits make that the useful default: the console never reports
mouse events to a Node process (only key events reach stdin) and ignores the xterm
mouse modes Pi enables, so the mouse wheel cannot scroll the transcript there; and it
cannot report modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT arrived in Windows 10), so
Shift+Enter never arrives. Ctrl+J is deliberately unbound in agent\keybindings.json
because this console emits stray line feeds that Pi would otherwise read as Ctrl+J and
turn into blank lines of their own, which leaves the console without a newline key.
mintty is a real pty and fixes all three - mouse-wheel scrolling, Shift+Enter and
truecolour. To stay in the plain console instead, where PageUp/PageDown scroll the
transcript:

       set PI_WIN7_CONSOLE=1       (PowerShell: $env:PI_WIN7_CONSOLE=1)
       pi.bat

Writing your own extensions
---------------------------
TypeScript needs no build step. Put a file in agent\extensions\ or load it
directly while developing:

       ./pi.bat --extension p:\ath\to\hello.ts

Change it, then type /reload inside Pi. See
pi\node_modules\@earendil-works\pi-coding-agent\docs\extensions.md and the 70+
examples next to it in pi-coding-agent\examples\extensions\.

Non-interactive use (works even in a plain cmd.exe window)
----------------------------------------------------------
       pi.bat -p "explain this project"
       pi.bat --mode json "list the files" > events.jsonl

Windows 7 adjustments
---------------------
pi.bat sizes the window to 120x34 (the console default of 80 columns splits paths
mid-word) and points Pi at agent\settings.json, which sets
terminal.clearOnShrink so rows the interface stops using do not stay on screen.
agent\keybindings.json drops Ctrl+J from the newline binding; see above.

An interactive start without arguments, and with TERM unset so Pi is not already in a
pty, opens Pi in mintty at 120x34. win7-mintty-launch.cjs starts mintty with two
shims loaded with node --require and waits for the probe shim to delete a probe file:
mintty always returns immediately because its window is a separate process, and it can
also exit 0 without running its child, so the probe is the only reliable way to tell
whether Pi really started. If it did not, pi.bat prints a hint and falls back to the
console. Set PI_WIN7_CONSOLE=1 (or PI_WIN7_MINTTY=0) to always use the console.

None of the shims touch the pi\ tree, so a Pi upgrade keeps them. The console path
loads three console shims; under mintty they see a non-TTY pipe and do nothing:

  win7-tty-width.cjs  reports one column and one row less than the console has.
                      Windows 7 wraps and scrolls as soon as the last cell or the last
                      row is written, where xterm waits for the next character, and the
                      difference garbles the frame and gives the input box an extra row.
  win7-boxascii.cjs   draws the borders in one-column ASCII. A Chinese, Japanese,
                      Korean or Traditional code page makes this console render box
                      drawing and other East Asian "ambiguous width" characters twice
                      as wide as Pi measures them, which wraps every frame and turns the
                      input box into a block of lines. The code page itself is left
                      alone, so Chinese keeps displaying and IME input keeps working.
  win7-ansi16.cjs     downgrades colour to the 16 the console has. Pi treats every
                      win32 console as truecolour; this one drops truecolour codes and
                      misreads 256-colour ones, which is why some colours vanish and
                      some text turns into inverse blocks.

The two colour and glyph shims have a switch for comparison runs
(PI_WIN7_BOXASCII=0, PI_WIN7_ANSI16=0), and neither applies when the output is
redirected to a file.

The two mintty shims:

  win7-mintty-tty.cjs   makes the MSYS pty look like a TTY. Native Windows Node sees
                        mintty's stdin and stdout as named pipes (isTTY is undefined),
                        so without this Pi starts in print mode and waits for piped
                        input forever - the black mintty window. The shim also reads
                        the pty size from MSYS stty, switches the pty to raw input
                        (otherwise the line discipline buffers every key and mouse
                        report until Enter), and emits resize events so Pi reflows
                        when the window is resized.
  win7-mintty-probe.cjs deletes a temp file once the child really starts, so the
                        launcher can tell mintty succeeded; it does nothing else.

Known limits
------------
* The terminal layer is partly verified and intentionally plain. Measured on Windows 7
  SP1: the interface renders, colours arrive as the console's 16, and Chinese displays.
  An interactive start uses mintty by default, so mouse-wheel scrolling, truecolour and
  Shift+Enter work; when mintty cannot run its child (or is absent), pi.bat notices and
  falls back to the console, where the wheel cannot scroll and PageUp/PageDown do.
  mintty uses its own font (Windows font linking gives Chinese and Japanese here), so
  a script that font does not cover can show as boxes; set a font fallback in mintty's
  options or set PI_WIN7_CONSOLE=1.
* pi.exe (the official single-file build) is NOT used here: it is compiled with
  Bun, which requires Windows 10 1809 or newer. That is why this package ships a
  Node runtime instead.
* The Node runtime is a community build (see Acknowledgements), not an official
  Node.js release. Official Node.js dropped Windows 7 in v20.3.0. See
  CHECKSUMS.txt and node\SOURCES.txt before trusting this package.
* Updates are disabled (PI_OFFLINE=1). This package is frozen on purpose: newer
  Pi releases raise the Node requirement again.
* Windows 7 itself no longer receives security updates.

Acknowledgements
----------------

The bundled Node.js runtime is a community build by DeftKing:
https://github.com/DeftKing/nodejs-win7

Without it pi could not run on Windows 7 at all - official Node.js dropped
Windows 7 in v20.3.0. That project carries no license file, so redistributing it
here is a deliberate choice; node\SOURCES.txt names the exact archive and its
sha256.

git\ is PortableGit from Git for Windows 2.46.2 (the last release supporting
Windows 7): https://github.com/git-for-windows/git/releases/tag/v2.46.2.windows.1
It is GPLv2 software redistributed unmodified as a separate program - Pi invokes
it, it is not linked into Pi. Its own LICENSE.txt ships inside git\.

Verification
------------
Run verify.ps1 in PowerShell on the target machine. It only reads, and prints
the version of every component so a failure points at one piece instead of "it
does not work". CHECKSUMS.txt lists the sha256 of each component; every hash in
it was taken from the build that produced this archive.
