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

rem mintty builds its session from git\etc\passwd, which PortableGit's own installer
rem creates by running this script; unpacking the archive elsewhere skips that.
if exist "%ROOT%git\post-install.bat" if not exist "%ROOT%git\etc\passwd" (
  call "%ROOT%git\post-install.bat" >nul 2>nul
  if errorlevel 1 echo [hint] git post-install failed; mintty may not open.
)

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

"%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
