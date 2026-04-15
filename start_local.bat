@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "PYTHON_EXE=C:\Python314\python.exe"

cd /d "%ROOT%"

echo Cerrando instancias previas en puertos %BACKEND_PORT% y %FRONTEND_PORT%...
call :kill_port %BACKEND_PORT%
call :kill_port %FRONTEND_PORT%

echo.
echo Iniciando backend en http://127.0.0.1:%BACKEND_PORT% ...
if not exist "%PYTHON_EXE%" (
  echo No se encontro Python en "%PYTHON_EXE%".
  echo Ajusta la variable PYTHON_EXE en start_local.bat y vuelve a intentar.
  echo.
  pause
  exit /b 1
)
start "CBR Backend" /D "%BACKEND_DIR%" cmd /k ""%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port %BACKEND_PORT%"

echo Iniciando frontend en http://127.0.0.1:%FRONTEND_PORT% ...
start "CBR Frontend" /D "%FRONTEND_DIR%" cmd /k "npm.cmd run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

echo.
echo Esperando a que ambos servicios respondan...
call :wait_http "http://127.0.0.1:%BACKEND_PORT%/health" "backend"
if errorlevel 1 goto :startup_failed

call :wait_http "http://127.0.0.1:%FRONTEND_PORT%" "frontend"
if errorlevel 1 goto :startup_failed

echo.
echo Listo. Abre:
echo   http://127.0.0.1:%FRONTEND_PORT%
echo   http://127.0.0.1:%BACKEND_PORT%/docs
echo.
pause
exit /b 0

:startup_failed
echo.
echo No se pudo confirmar que ambos servicios quedaran arriba.
echo Revisa las ventanas "CBR Backend" y "CBR Frontend" para ver el error.
echo.
pause
exit /b 1

:kill_port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)
exit /b 0

:wait_http
set "WAIT_URL=%~1"
set "WAIT_NAME=%~2"
for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%WAIT_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    echo   %WAIT_NAME% listo.
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
echo   %WAIT_NAME% no respondio a tiempo.
exit /b 1
