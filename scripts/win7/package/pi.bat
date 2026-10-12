@echo off
setlocal
set "ROOT=%~dp0"
if not exist "%ROOT%node\node.exe" (
  echo [ERROR] missing node\node.exe -- unzip the whole archive, do not copy files out of it.
  exit /b 1
)
set "PI_CODING_AGENT_DIR=%ROOT%agent"
set "PI_OFFLINE=1"
set "PATH=%ROOT%node;%PATH%"
"%ROOT%node\node.exe" "%ROOT%pi\node_modules\@earendil-works\pi-coding-agent\dist\bundle\cli.js" %*
exit /b %ERRORLEVEL%
