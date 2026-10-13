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
   rights, no registry. Pi starts in the window you launched it from.
2. First run: /login to connect a provider, then /model to pick a model.

Shift+Enter does not work in that window: the Windows 7 console cannot report
modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT arrived in Windows 10), and Ctrl+J is
deliberately unbound in agent\keybindings.json because this console emits stray line
feeds that Pi would otherwise read as Ctrl+J and turn into blank lines of their own.
That leaves the console without a newline key, which is the lesser evil; multi-line
prompts need the bundled mintty instead:

       set PI_WIN7_MINTTY=1       (PowerShell: $env:PI_WIN7_MINTTY=1)
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

The console path also loads three shims with node --require. None of them touch the
pi\ tree, so a Pi upgrade keeps them, and mintty is a real pty, so it loads none of
them:

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

Known limits
------------
* The terminal layer is partly verified and intentionally plain. Measured on Windows 7
  SP1: the interface renders, colours arrive as the console's 16, and Chinese displays.
  That console has no VT support and cannot report modified keys, so Shift+Enter is
  unavailable and the console has no newline key - see above. For truecolour and
  Shift+Enter set PI_WIN7_MINTTY=1, but mintty is not the default: it exits 0 without
  running its child in some environments, which would leave pi.bat doing nothing.
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
