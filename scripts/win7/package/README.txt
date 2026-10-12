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
      pi/         the Pi program tree
      agent/      your data: settings, sessions, credentials, extensions
      agent/bin/  rg.exe + fd.exe, pinned to the last Windows 7-compatible builds

How to start
------------
1. Install Git for Windows 2.46.2 (the last Windows 7 version). It provides two
   things Pi needs: the "bash" tool, and mintty (a terminal that understands
   ANSI/VT escapes - the Windows 7 console does not).
2. Open mintty (Git Bash) and run:

       cd /d/pi-win7-x64
       ./pi.bat

   Do NOT double-click pi.bat in Explorer: that opens a cmd.exe window, and the
   Windows 7 console cannot render Pi's interface. Always start it from mintty
   or ConEmu (with "ANSI and xterm sequences" enabled).
3. If Enter behaves oddly (Shift+Enter submits instead of adding a line), press
   Ctrl+J for a newline. Windows 7 cannot report modified keys, so Pi never sees
   the Shift.
4. First run: /login to connect a provider, then /model to pick a model.

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

Known limits
------------
* The terminal layer is the one part nobody has verified on Windows 7. If mintty
  misbehaves, try ConEmu; if the interface is unreadable in a window, use the
  -p / --mode json forms above.
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

Verification
------------
Run verify.ps1 in PowerShell on the target machine. It only reads, and prints
the version of every component so a failure points at one piece instead of "it
does not work". CHECKSUMS.txt lists the sha256 of each component; every hash in
it was taken from the build that produced this archive.
