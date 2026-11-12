@echo off
chcp 65001 >nul
setlocal
rem 공업수학 시각화(studio) 실행 파일
rem 처음 실행하면 .venv 가상환경을 만들고 PySide6를 설치합니다(인터넷 필요). 그다음부터는 바로 열립니다.
rem "시각화 실행.bat --check"는 창을 띄우지 않고 준비 상태만 확인합니다.
cd /d "%~dp0"
set "VENV_PY=.venv\Scripts\python.exe"
set "VENV_PYW=.venv\Scripts\pythonw.exe"

if exist "%VENV_PY%" goto packages

echo [1/3] Python 3.10 이상을 찾는 중입니다...
set "BASE_PY="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if not errorlevel 1 set "BASE_PY=py -3"
if defined BASE_PY goto create
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if not errorlevel 1 set "BASE_PY=python"
if defined BASE_PY goto create
echo.
echo Python 3.10 이상을 찾지 못했습니다.
echo https://www.python.org/downloads/ 에서 Python을 설치한 뒤 다시 실행하십시오.
echo 설치 첫 화면에서 "Add python.exe to PATH"를 선택하십시오.
pause
exit /b 1

:create
echo [2/3] 가상환경 .venv를 만드는 중입니다...
%BASE_PY% -m venv .venv
if errorlevel 1 (
    echo 가상환경을 만들지 못했습니다.
    pause
    exit /b 1
)

:packages
"%VENV_PY%" -c "import PySide6.QtWebEngineWidgets" >nul 2>nul
if not errorlevel 1 goto ready
echo [3/3] 화면 라이브러리 PySide6를 설치하는 중입니다. 처음 한 번만 몇 분 걸립니다(인터넷 필요).
"%VENV_PY%" -m pip install --disable-pip-version-check PySide6
if errorlevel 1 (
    echo.
    echo PySide6 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하십시오.
    pause
    exit /b 1
)

:ready
if not exist "studio\app.py" (
    echo studio\app.py를 찾지 못했습니다. 저장소 폴더 전체를 내려받았는지 확인하십시오.
    pause
    exit /b 1
)
if /i "%~1"=="--check" (
    echo 준비 완료: "시각화 실행.bat"을 더블클릭하면 프로그램이 열립니다.
    exit /b 0
)
start "" "%VENV_PYW%" "studio\app.py"
