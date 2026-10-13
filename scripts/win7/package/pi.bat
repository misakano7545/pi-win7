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

rem A full-screen TUI needs room: at the console default of 80 columns long paths split
rem mid-word and the status area collides. Not inside Windows Terminal though: that ignores
rem app-initiated resizes, so `mode con` would only change the size conhost reports while the
rem window keeps its own, and Pi would lay its frame out for rows nobody can see
rem (microsoft/terminal#5094).
if not defined WT_SESSION mode con cols=120 lines=34 >nul 2>nul

rem Windows 10 and later understand VT output and input, report the mouse and draw box
rem drawing and true colour properly, so Pi's TUI runs natively there: no mintty, no
rem compatibility shims. Everything older needs both. Decide once and export
rem PI_WIN7_CONSOLE_SHIMS=1, which is also the switch to force either path by hand.
if not defined PI_WIN7_CONSOLE_SHIMS (
  "%ROOT%node\node.exe" -e "process.exit(Number(require('node:os').release().split('.')[0]) < 10 ? 0 : 1)"
  if not errorlevel 1 set "PI_WIN7_CONSOLE_SHIMS=1"
)

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
rem win7-boxascii draws the borders in one-column ASCII (a 936 code page renders
rem them full-width and wraps the input box), and win7-ansi16 downgrades colour to
rem the 16 this console has. win7-mintty-tty.cjs does nothing in a real console; it
rem only activates when this path runs inside mintty, where the three see a non-TTY
rem and skip, so Pi still starts interactive there. On Windows 10 and later the three do
rem nothing at all, because that console draws the frame itself.
"%ROOT%node\node.exe" --require "%ROOT%win7-tty-width.cjs" --require "%ROOT%win7-boxascii.cjs" --require "%ROOT%win7-ansi16.cjs" --require "%ROOT%win7-mintty-tty.cjs" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
