# 인터넷 없이 실행되는 Windows 프로그램을 <DistPath>\LectureStudio에 만듭니다(기본 ..\dist).
param([string]$DistPath = '..\dist')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    # 그 폴더의 프로그램이 실행 중이면 파일이 잠겨 빌드가 중간에 실패하므로 먼저 멈춥니다.
    $target = Join-Path (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force $DistPath)).Path 'LectureStudio'
    $running = Get-Process LectureStudio -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($target, [StringComparison]::OrdinalIgnoreCase) }
    if ($running) { throw "$target 의 프로그램이 실행 중입니다. 닫은 뒤 다시 빌드하거나 -DistPath로 다른 폴더를 지정하십시오." }
    $python = '..\.venv\Scripts\python.exe'
    & $python -m PyInstaller --noconfirm --windowed --onedir --name LectureStudio --distpath $DistPath --workpath ..\build\studio --specpath ..\build\studio --add-data "$PSScriptRoot\web;web" app.py
    if ($LASTEXITCODE -ne 0) { throw 'PyInstaller 빌드에 실패했습니다.' }
} finally { Pop-Location }
