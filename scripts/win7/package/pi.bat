@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%node\node.exe" (
  echo [ERROR] missing node\node.exe -- unzip the whole archive, do not copy files out of it.
  exit /b 1
)

rem Interactive start from the Windows 7 console: that console cannot report
rem modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT does not exist before Windows 10),
rem so reopen inside mintty. Only for the interactive case -- -p and pipes must not
rem be sent to a new window. A mintty already on PATH wins so this stays testable.
if "%~1"=="" if not defined TERM if not defined PI_WIN7_NO_MINTTY (
  set "MINTTY="
  where mintty >nul 2>nul
  if not errorlevel 1 set "MINTTY=mintty"
  if not defined MINTTY if exist "%ROOT%git\usr\bin\mintty.exe" set "MINTTY=%ROOT%git\usr\bin\mintty.exe"
  if defined MINTTY (
    echo [mintty] restarting Pi in mintty so modified keys work
    rem /wait, so a mintty that dies on startup falls through to running Pi in this
    rem window instead of leaving the user with nothing.
    start /wait "" "%MINTTY%" -e cmd /c "%~f0"
    if not errorlevel 1 exit /b 0
    echo [hint] mintty did not start; running Pi in this window. Ctrl+J inserts a newline.
  ) else (
    echo [hint] no mintty found; running Pi in this window. Ctrl+J inserts a newline.
  )
)

rem A full-screen TUI needs room: at the console default of 80 columns long paths
rem split mid-word and the status area collides.
mode con cols=120 lines=34 >nul 2>nul

set "PI_CODING_AGENT_DIR=%ROOT%agent"
set "PI_OFFLINE=1"
set "PATH=%ROOT%node;%ROOT%git\cmd;%ROOT%git\usr\bin;%PATH%"
"%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
