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

rem Windows 7's console cannot report modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT
rem does not exist before Windows 10) and echoes stray bytes into Pi's input, so
rem Shift+Enter never arrives and typing can insert a line of its own. mintty is a
rem real pty and fixes both, but it stays opt-in until it is confirmed on the target.
if "%~1"=="" if defined PI_WIN7_MINTTY if not defined TERM if exist "%ROOT%git\usr\bin\mintty.exe" (
  echo [mintty] opening Pi in mintty
  rem Pass node and the entry script directly: msys rewrites "/"-prefixed arguments,
  rem so routing this through `cmd /c <script>` silently runs nothing.
  start /wait "" "%ROOT%git\usr\bin\mintty.exe" "%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js"
  rem 255 is mintty's own "could not execute the program" status.
  if errorlevel 255 (
    echo [hint] mintty could not start the program; running Pi in this window instead.
  ) else (
    exit /b 0
  )
)

rem A full-screen TUI needs room: at the console default of 80 columns long paths
rem split mid-word and the status area collides.
mode con cols=120 lines=34 >nul 2>nul

rem The console path needs all three shims; mintty above is a real pty and needs
rem none of them. win7-tty-width keeps Pi off the last cell and last row this
rem console scrolls on, win7-boxascii draws the borders in one-column ASCII (a 936
rem code page renders them full-width and wraps the input box), and win7-ansi16
rem downgrades colour to the 16 this console has.
"%ROOT%node\node.exe" --require "%ROOT%win7-tty-width.cjs" --require "%ROOT%win7-boxascii.cjs" --require "%ROOT%win7-ansi16.cjs" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
