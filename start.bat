@echo off
echo Starting Expense Tracker...

REM Start backend
start cmd /k "cd /d D:\expense-tracker\backend && c:\python314\python.exe manage.py runserver 0.0.0.0:8000"

REM Start frontend
start cmd /k "cd /d D:\expense-tracker\frontend && npm run dev -- --host 0.0.0.0"

echo Servers started.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo For mobile, use your PC's IP address instead of localhost.
pause