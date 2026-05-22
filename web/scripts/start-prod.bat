@echo off
rem GTVS Dashboard production server — Task Scheduler 가 호출. .runlogs\server.log 에 stdout/err 적재.
cd /d C:\GTVS\dashboard\web
if not exist .runlogs mkdir .runlogs
echo. >> .runlogs\server.log
echo [%date% %time%] starting next start >> .runlogs\server.log
call npm.cmd run start >> .runlogs\server.log 2>&1
