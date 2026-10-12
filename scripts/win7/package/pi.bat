@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%node\node.exe" (
  echo [ERROR] missing node\node.exe -- unzip the whole archive, do not copy files out of it.
  exit /b 1
)

rem Interactive start from the Windows 7 console: that console cannot report
rem modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT does not exist before Windows 10),
rem so reopen inside mintty, which Git for Windows -- already required for the bash
rem tool -- installs. Only for the interactive case: -p and pipes must not be sent
rem to a new window.
if "%~1"=="" if not defined TERM if not defined PI_WIN7_NO_MINTTY (
  set "MINTTY="
  for %%d in ("%ProgramFiles%\Git\usr\bin" "%ProgramFiles(x86)%\Git\usr\bin") do (
    if exist "%%~d\mintty.exe" set "MINTTY=%%~d\mintty.exe"
  )
  if not defined MINTTY (
    where mintty >nul 2>nul && set "MINTTY=mintty"
  )
  if defined MINTTY (
    echo [mintty] restarting Pi in mintty so modified keys work
    start "" "%MINTTY%" -e cmd /c "%~f0"
    exit /b 0
  )
  echo [hint] Ctrl+J inserts a newline here. Install Git for Windows 2.46.2 for mintty.
)

rem A full-screen TUI needs room: at the console default of 80 columns long paths
rem split mid-word and the status area collides.
mode con cols=120 lines=34 >nul 2>nul

set "PI_CODING_AGENT_DIR=%ROOT%agent"
set "PI_OFFLINE=1"
set "PATH=%ROOT%node;%PATH%"
"%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
