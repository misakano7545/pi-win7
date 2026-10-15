Pi for Windows 7 - portable package
===================================

by MisakaNo小御坂 - https://github.com/misakano7545/pi-win7

中文说明
========

这是什么
--------
自带运行环境的 Pi Agent，专为 Windows 7 SP1 x64 打包。解压到任意位置就能用：U 盘、
桌面、C:\pi 都行。不装东西、不动注册表、不用 npm，第一次启动也不需要联网。

    pi-win7-x64/
      pi.bat      启动入口（官方包里这个位置是 pi.exe）
      node/       能在 Windows 7 上跑的 Node.js 运行时
      git/        便携版 Git：给 Pi 的 bash 工具提供 bash，也提供 mintty 终端
      pi/         Pi 程序本体
      agent/      你的数据：设置、会话、凭据、扩展
      agent/bin/  rg.exe 和 fd.exe

怎么开始
--------
1. 双击 pi.bat。就这样，不用先装任何东西，也不需要管理员权限。
2. 第一次运行先 /login 连接服务商，再用 /model 选模型。

默认会用包里自带的 mintty 打开。原因是 Windows 7 的控制台有三个绕不过的限制：收不到
鼠标事件（滚轮不能滚记录）、报不出修饰键（Shift+Enter 收不到），还会冒出杂散的换行
字节（所以 agent\keybindings.json 主动解绑了 Ctrl+J，代价是控制台里没有换行键）。
mintty 是真正的 pty，这三样都能用。

想留在普通控制台里跑，用 PageUp/PageDown 翻页：

      set PI_WIN7_CONSOLE=1      (PowerShell: $env:PI_WIN7_CONSOLE=1)
      pi.bat

要是 mintty 没能把 Pi 拉起来（有些环境下它会直接退出），pi.bat 会提示一句，然后回落
到控制台。另外 agent\settings.json 打开了 terminal.clearOnShrink，界面不再用的行会被
清掉，不会一直留在屏幕上。

非交互调用（普通 cmd 窗口里也能用）
-----------------------------------
      pi.bat -p "解释这个项目"
      pi.bat --mode json "列出文件" > events.jsonl

写自己的扩展
------------
TypeScript 不需要构建：把文件放进 agent\extensions\，或者开发时直接加载：

      ./pi.bat --extension p:\ath\to\hello.ts

改完在 Pi 里打 /reload 就生效。详细写法和七十多个例子在
pi\node_modules\@earendil-works\pi-coding-agent\docs\extensions.md 和它旁边的
examples\extensions\ 里（都是英文）。

控制台里的界面为什么更朴素
--------------------------
Windows 7 的控制台没有 VT/ANSI 支持，而 Pi 按真彩色绘制，所以 cmd 里的颜色只有 16
色、边框是 ASCII。三个垫片在启动时把界面压到控制台能显示的范围内，它们不改 pi\ 里的
任何文件，升级 Pi 也不会丢：

  win7-tty-width.cjs  报出去的行列各减 1。这个控制台写满最后一格就立刻上滚，xterm 是
                      等下一个字符才滚；不减 1 的话每次重绘整屏都往上跑一行，输入框跟
                      着错位。
  win7-boxascii.cjs   边框改用单列 ASCII。中文代码页会把制表符这类“宽度模糊”的字符按
                      两格宽画，Pi 却按一格算，不改写就会折行，输入框变成一坨横线。代
                      码页不动，中文显示和输入法都照常。
  win7-ansi16.cjs     把 256 色和真彩色降级成控制台支持的 16 色。这个控制台会丢掉真彩
                      色码，256 色则会落到错误的属性上，看起来像反相的色块。

三个垫片各有对比开关：PI_WIN7_TTY_WIDTH=0、PI_WIN7_BOXASCII=0、PI_WIN7_ANSI16=0。
输出被重定向到文件时三个都不生效。Windows 10 及以上不需要颜色和边框的改写，那里的控
制台懂 VT，也会上报鼠标；宽度垫片仍然生效（Win7 和 Win11 的控制台都是写满最后一格就
滚）。PI_WIN7_CONSOLE_SHIMS=1 或 =0 可以强制走兼容路径或原生路径。

别用 chcp 437 去修边框：边框是好看了，但控制台就不能显示中文了（“中文测试”会变成
“????”）。pi.bat 也只在 Windows 10 以下请求 120x34 的控制台尺寸；Windows 10 及以上不
动控制台，窗口小了自己拉大就行，因为 Windows Terminal 会忽略程序发起的改尺寸。

已知限制
--------
* 控制台下只有 16 色、边框是 ASCII，这是 Windows 7 控制台本身的限制，不是没修好。
* 控制台里没有换行键：Shift+Enter 收不到，Ctrl+J 又被解绑了。默认走 mintty 就没这个
  问题。
* mintty 用自己的字体（一般能显示中英日文），字体覆盖不到的字会显示成方框。可以在
  mintty 选项里设一个回退字体，或者设 PI_WIN7_CONSOLE=1。
* 官方的 pi.exe 用不了，那是 Bun 编译的单文件，Bun 要求 Windows 10 1809 起，所以这里
  换成了自带的 Node 运行时。
* 自带的 Node.js 是社区构建（见下面的致谢），不是官方发布版。官方在 v20.3.0 就放弃了
  Windows 7。用之前可以看 node\SOURCES.txt 和 CHECKSUMS.txt。
* 自动更新已关闭（PI_OFFLINE=1）。这个包是有意冻结版本的：更新的 Pi 会再次抬高 Node
  的版本要求。
* Windows 7 本身已经不再收到安全更新。

校验
----
在目标机上用 PowerShell 运行 verify.ps1。它只读文件，会打印每个组件的版本，出问题时
能直接看出是哪一件。CHECKSUMS.txt 列出每个组件的 sha256，都取自构建这个压缩包的那次
构建。

致谢
----
自带的 Node.js 运行时是 DeftKing 的社区构建：
https://github.com/DeftKing/nodejs-win7
没有它 Pi 根本没法在 Windows 7 上运行。这个项目没有 license 文件，在这里重新分发是一
个刻意的选择，node\SOURCES.txt 记了确切的压缩包和它的 sha256。

git\ 是 Git for Windows 2.46.2 的 PortableGit（最后一个支持 Win7 的版本）：
https://github.com/git-for-windows/git/releases/tag/v2.46.2.windows.1
GPLv2 软件，作为独立程序原样分发，Pi 调用它但不链接它，它自己的 LICENSE.txt 就在
git\ 里面。

下载
----
https://github.com/misakano7545/pi-win7/releases

English (the original document)
===============================
Everything below is the original English text. It is the authoritative version and
carries the implementation detail the Chinese section leaves out.

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
   rights, no registry. Pi starts in the bundled mintty terminal.
2. First run: /login to connect a provider, then /model to pick a model.

An interactive start opens Pi in git\usr\bin\mintty.exe, the bundled terminal. Two
Windows 7 console limits make that the useful default: the console never reports
mouse events to a Node process (only key events reach stdin) and ignores the xterm
mouse modes Pi enables, so the mouse wheel cannot scroll the transcript there; and it
cannot report modified keys (ENABLE_VIRTUAL_TERMINAL_INPUT arrived in Windows 10), so
Shift+Enter never arrives. Ctrl+J is deliberately unbound in agent\keybindings.json
because this console emits stray line feeds that Pi would otherwise read as Ctrl+J and
turn into blank lines of their own, which leaves the console without a newline key.
mintty is a real pty and fixes all three - mouse-wheel scrolling, Shift+Enter and
truecolour. To stay in the plain console instead, where PageUp/PageDown scroll the
transcript:

       set PI_WIN7_CONSOLE=1       (PowerShell: $env:PI_WIN7_CONSOLE=1)
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
pi.bat asks the console for 120x34 below Windows 10, where the console host owns the window
and follows a resize (the console default of 80 columns splits paths mid-word). From Windows
10 on it leaves the console alone: Windows Terminal may be showing that console and ignores
an app-initiated resize, so asking for rows would leave Pi laying its frame out for rows the
window does not have, which pushes the input box off screen. Widen the window itself when the
interface is cramped. pi.bat also points Pi at agent\settings.json, which sets
terminal.clearOnShrink so rows the interface stops using do not stay on screen.
agent\keybindings.json drops Ctrl+J from the newline binding; see above.

An interactive start without arguments, and with TERM unset so Pi is not already in a
pty, opens Pi in mintty at 120x34. win7-mintty-launch.cjs starts mintty with two
shims loaded with node --require and waits for the probe shim to delete a probe file:
mintty always returns immediately because its window is a separate process, and it can
also exit 0 without running its child, so the probe is the only reliable way to tell
whether Pi really started. If it did not, pi.bat prints a hint and falls back to the
console. Set PI_WIN7_CONSOLE=1 (or PI_WIN7_MINTTY=0) to always use the console.

Windows 10 and later need none of the colour work: their console understands VT output and
input and reports the mouse, so the colour and glyph shims do nothing there. An interactive
start then runs Pi's own TUI in the console at whatever size the console's host gave the
window, because pi.bat asks for no size there (see above). Set PI_WIN7_CONSOLE_SHIMS=1 to force
the compatibility path on any Windows, or =0 to force the native one. The width shim is not
part of that tier: conhost
scrolls when the last cell of the last row is written on Windows 7 and Windows 11 alike, and
without the shim Pi's frame lands a row out of place and the input box goes with it. Set
PI_WIN7_TTY_WIDTH=0 to disable it.

None of the shims touch the pi\ tree, so a Pi upgrade keeps them. The console path
loads three console shims, which do nothing under mintty (a non-TTY pipe); on Windows 10
and later only the colour and glyph ones stand down:

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

The colour, glyph and width shims each have a switch for comparison runs
(PI_WIN7_BOXASCII=0, PI_WIN7_ANSI16=0, PI_WIN7_TTY_WIDTH=0), and none of the three applies
when the output is redirected to a file.

The two mintty shims:

  win7-mintty-tty.cjs   makes the MSYS pty look like a TTY. Native Windows Node sees
                        mintty's stdin and stdout as named pipes (isTTY is undefined),
                        so without this Pi starts in print mode and waits for piped
                        input forever - the black mintty window. The shim also reads
                        the pty size from MSYS stty, switches the pty to raw input
                        (otherwise the line discipline buffers every key and mouse
                        report until Enter), and emits resize events so Pi reflows
                        when the window is resized.
  win7-mintty-probe.cjs deletes a temp file once the child really starts, so the
                        launcher can tell mintty succeeded; it does nothing else.

Known limits
------------
* The terminal layer is partly verified and intentionally plain. Measured on Windows 7
  SP1: the interface renders, colours arrive as the console's 16, and Chinese displays.
  On Windows 7 an interactive start uses mintty by default, so mouse-wheel scrolling,
  truecolour and Shift+Enter work; when mintty cannot run its child (or is absent), pi.bat
  notices and falls back to the console, where the wheel cannot scroll and PageUp/PageDown
  do. On Windows 10 and later Pi draws its own TUI in the console instead, Windows Terminal
  included -- pi.bat leaves that window alone, because WT ignores app-initiated resizes. The
  width shim keeps the frame off the edge that scrolls either way.
  mintty uses its own font (Windows font linking gives Chinese and Japanese here), so
  a script that font does not cover can show as boxes; set a font fallback in mintty's
  options or set PI_WIN7_CONSOLE=1.
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
