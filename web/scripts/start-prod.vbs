' GTVS Dashboard 백그라운드 기동 래퍼 — Task Scheduler 가 호출. cmd 콘솔 창 표시 0(hidden).
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\GTVS\dashboard\web\scripts\start-prod.bat""", 0, False
