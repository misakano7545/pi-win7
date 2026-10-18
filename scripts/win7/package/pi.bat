@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%node\node.exe" (
  echo [ERROR] missing node\node.exe -- unzip the whole archive, do not copy files out of it.
  exit /b 1
)

set "PI_CODING_AGENT_DIR=%ROOT%agent"
set "PI_OFFLINE=1"
set "PATH=%ROOT%node;%ROOT%git\cmd;%ROOT%git\usr\bin;%PATH%"

rem One Node call decides whether this is the old console. Below Windows 10 the console host
rem owns its window, follows a resize, and needs every compatibility shim; from Windows 10 on
rem Pi draws the frame itself and only the shims whose job the console still does not do (the
rem width, and the glyphs while the console is on a CJK code page) stay. PI_WIN7_CONSOLE_SHIMS=1/0
rem still forces the tier by hand, but the size request below goes by the OS alone.
set "PI_OLD_CONSOLE="
"%ROOT%node\node.exe" -e "process.exit(Number(require('node:os').release().split('.')[0]) < 10 ? 0 : 1)"
if not errorlevel 1 set "PI_OLD_CONSOLE=1"
if not defined PI_WIN7_CONSOLE_SHIMS if defined PI_OLD_CONSOLE set "PI_WIN7_CONSOLE_SHIMS=1"

rem A full-screen TUI needs room: at the console default of 80 columns long paths split
rem mid-word and the status area collides. Only the console host is ever asked for it, and it
rem is the one that owns the window below Windows 10. From Windows 10 the console may instead
rem be shown by a terminal: Windows 11 hands a double-clicked pi.bat to Windows Terminal,
rem which ignores an app-initiated resize and sets no WT_SESSION when it did not start that
rem console itself. The console then reports more rows than the window has, and Pi, laying its
rem frame out for the size it is told, draws the input box and the working-directory line
rem below the visible area -- an empty screen with a status bar under it and nothing to type
rem into (microsoft/terminal#5094, WT's default-terminal handoff). Those consoles keep the size
rem their host gave them; widen the window itself when the interface is cramped.
if defined PI_OLD_CONSOLE mode con cols=120 lines=34 >nul 2>nul

rem That older console cannot report modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT does
rem not exist before Windows 10), never reports mouse events to a Node process (only key
rem events reach stdin) and ignores the xterm mouse modes Pi enables, so Shift+Enter
rem never arrives, typing can insert a line of its own, and the mouse wheel cannot
rem scroll the transcript. mintty is a real pty and fixes all three, so it is the default
rem on that tier. Set PI_WIN7_CONSOLE=1 (or PI_WIN7_MINTTY=0) to stay in the console,
rem where PageUp/PageDown scroll instead.
if "%~1"=="" if "%PI_WIN7_CONSOLE_SHIMS%"=="1" if not defined PI_WIN7_CONSOLE if not "%PI_WIN7_MINTTY%"=="0" if not defined TERM if exist "%ROOT%git\usr\bin\mintty.exe" (
  echo [mintty] opening Pi in mintty
  rem mintty always returns immediately, so the launcher starts it and watches the
  rem probe file that win7-mintty-probe.cjs deletes once the child really runs.
  "%ROOT%node\node.exe" "%ROOT%win7-mintty-launch.cjs" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js"
  if errorlevel 1 (
    echo [hint] mintty did not start Pi; running Pi in this window instead.
  ) else (
    exit /b 0
  )
)

rem The console path loads the three console shims first, then the TTY shim:
rem win7-tty-width keeps Pi off the last cell and last row this console scrolls on,
rem win7-boxascii draws the borders in one-column ASCII and redraws the startup logo as
rem four cells of cell-background colour -- coral bar, blue stem, yellow dot -- because a 936
rem code page draws box drawing and blocks with a CJK font wider than the cell, which breaks
rem the frame and smears the half-block art. Spaces and background colours are one cell in
rem every font, so the logo survives the code page. win7-ansi16 downgrades colour
rem to the 16 this console has. win7-mintty-tty.cjs does nothing in a real console; it only activates
rem when this path runs inside mintty, where the three see a non-TTY and skip, so Pi still
rem starts interactive there. On Windows 10 and later the colour shim stands down because
rem that console draws colour itself; the glyph shim still applies while the console runs
rem on a Chinese, Japanese or Korean code page, because the width of those glyphs follows
rem the code page there just as it does below Windows 10. A terminal that draws the screen
rem itself (Windows Terminal, VS Code, WezTerm) uses its own font, so the shim steps aside
rem there and keeps the native frame and logo.
"%ROOT%node\node.exe" --require "%ROOT%win7-tty-width.cjs" --require "%ROOT%win7-boxascii.cjs" --require "%ROOT%win7-ansi16.cjs" --require "%ROOT%win7-mintty-tty.cjs" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
