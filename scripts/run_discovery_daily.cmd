@echo off
REM Monthly entry point for the unattended discovery sweep, called by Windows
REM Task Scheduler (task name: BkkRealEstateDiscovery, runs on the 1st of each
REM month at 01:00 — was daily until 2026-07-04, throttled back because daily
REM scraping + full-table rescoring was burning Supabase egress quota against
REM <50 site users). Runs ONE pass-set and exits. Keeps a per-run log so a
REM failed run is debuggable.
REM
REM Guard: if a discovery run is already alive (e.g. a long manual run, or the
REM previous run overran), skip this launch so we never stack two nodriver
REM fleets on the 16GB laptop.

setlocal
set REPO=C:\Users\yn\Desktop\Work\1_active\bangkok-real-estate-engine
cd /d "%REPO%"

REM Already running? bail.
tasklist /v /fi "imagename eq python.exe" 2>nul | findstr /i "overnight_discovery" >nul
if %errorlevel%==0 (
  echo [%date% %time%] discovery already running - skipping daily launch >> "%REPO%\logs\discovery.cron.log"
  exit /b 0
)

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul ^| find "="') do set DT=%%I
set STAMP=%DT:~0,8%
echo [%date% %time%] launching daily discovery --hours 12 >> "%REPO%\logs\discovery.cron.log"

python scripts\overnight_discovery.py --hours 12 ^
  1>> "%REPO%\logs\discovery.%STAMP%.out.log" ^
  2>> "%REPO%\logs\discovery.%STAMP%.err.log"

echo [%date% %time%] daily discovery exited code %errorlevel% >> "%REPO%\logs\discovery.cron.log"
endlocal
