@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%node\node.exe" (
  echo [ERROR] missing node\node.exe -- unzip the whole archive, do not copy files out of it.
  exit /b 1
)

rem Windows 7's console cannot report modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT
rem does not exist before Windows 10), so Shift+Enter never arrives. The bundled
rem mintty fixes that, but it is opt-in: mintty can exit 0 without running its
rem child, which turns the default entry point into "nothing happens".
if "%~1"=="" if defined PI_WIN7_MINTTY if not defined TERM if exist "%ROOT%git\usr\bin\mintty.exe" (
  echo [mintty] opening Pi in mintty
  start /wait "" "%ROOT%git\usr\bin\mintty.exe" -e cmd /c "%~f0"
  if not errorlevel 1 exit /b 0
  echo [hint] mintty did not start; running Pi in this window instead.
)

rem A full-screen TUI needs room: at the console default of 80 columns long paths
rem split mid-word and the status area collides.
mode con cols=120 lines=34 >nul 2>nul

set "PI_CODING_AGENT_DIR=%ROOT%agent"
set "PI_OFFLINE=1"
set "PATH=%ROOT%node;%ROOT%git\cmd;%ROOT%git\usr\bin;%PATH%"
"%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
