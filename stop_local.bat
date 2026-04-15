@echo off
setlocal

echo Cerrando servidores locales de GeoCBR Studio...

call :kill_port 5173
call :kill_port 8000

echo.
echo Se intentaron cerrar los procesos que usan:
echo   http://127.0.0.1:5173
echo   http://127.0.0.1:8000
echo.
pause
exit /b 0

:kill_port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)
exit /b 0
