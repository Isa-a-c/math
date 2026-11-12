"""배포본을 만듭니다: PyInstaller 빌드 → 실행 안내 → ZIP과 SHA-256 → 한글 경로에 풀어 실행 파일 자체 검사.

저장소 폴더에서 실행합니다(가상환경 .venv에 PySide6와 PyInstaller 필요).
    .venv\\Scripts\\python studio\\release.py              빌드부터 검사까지
    .venv\\Scripts\\python studio\\release.py --skip-build 이미 빌드한 dist\\LectureStudio로 ZIP과 검사만

버전은 studio/web/version.js의 APP_VERSION을 씁니다. 결과는 dist/LectureStudio-v<버전>-windows-x64.zip입니다.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
ROOT = STUDIO.parent
DIST = ROOT / 'dist'
FOLDER = DIST / 'LectureStudio'
VERSION = re.search(r"APP_VERSION = '([^']+)'", (STUDIO / 'web' / 'version.js').read_text(encoding='utf-8')).group(1)

GUIDE = f"""공업수학 시각화 v{VERSION}

LectureStudio.exe를 더블클릭하십시오. Python과 인터넷이 없어도 실행됩니다.
_internal 폴더를 포함한 전체 폴더를 함께 두십시오.
Windows가 'PC 보호' 창을 띄우면 '추가 정보 → 실행'을 누르십시오.
처음 열면 안내가 나오고, 위쪽 '도움말'에서 언제든 다시 볼 수 있습니다.

시각화 화면: 함수를 입력하고 개념을 체크하면 그래프가 그 개념으로 바뀝니다.
  그래프 위 도구: 그래프 담기, 고정(비교), 보기(값 읽기·Ctrl+휠 확대·끌어서 이동), 펜, 점.
  그래프를 누른 뒤 키보드: ←→ 값 읽기, Shift+←→ 이동, +/− 확대, 0 원래대로, Enter 점 표시.
예제·출력 화면: 문제 문장·배점·풀이 메모를 쓰고 예제를 모아 Word나 PDF로 출력합니다.
  지운 것은 알림의 '되돌리기'나 Ctrl+Z로 되살립니다. 만든 내용은 자동 저장됩니다.
  다른 PC로 옮기려면 '예제 모음 저장'으로 파일을 만드십시오.

단축키: F 발표 모드, Space 재생·일시정지, Ctrl+Z 되돌리기, Esc 닫기.
"""


def running():
    """dist\\LectureStudio의 프로그램이 실행 중이면 빌드가 파일을 지우지 못하므로 먼저 확인합니다."""
    out = subprocess.run(['powershell', '-NoProfile', '-Command', "Get-Process LectureStudio -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }"], capture_output=True, text=True).stdout
    return [p for p in out.splitlines() if p.strip().lower().startswith(str(FOLDER).lower())]


def main():
    if '--skip-build' not in sys.argv:
        if running():
            sys.exit(f'{FOLDER}의 프로그램이 실행 중입니다. 닫은 뒤 다시 실행하십시오.')
        print('[1/4] 빌드')
        r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(STUDIO / 'build.ps1')], cwd=ROOT)
        if r.returncode:
            sys.exit('빌드에 실패했습니다.')
    print('[2/4] 실행 안내')
    (FOLDER / '실행 안내.txt').write_text(GUIDE, encoding='utf-8-sig')
    print('[3/4] ZIP과 SHA-256')
    archive = DIST / f'LectureStudio-v{VERSION}-windows-x64.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in FOLDER.rglob('*'):
            if f.is_file():
                z.write(f, f.relative_to(DIST))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.sha256').write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    print(f'      {archive.name} {archive.stat().st_size / 1024 ** 2:.1f} MiB')
    print('[4/4] 한글 경로에 풀어 자체 검사 (Python 경로 없이)')
    (ROOT / 'build').mkdir(exist_ok=True)
    test = Path(tempfile.mkdtemp(prefix='한글 배포 검사 ', dir=ROOT / 'build'))
    try:
        with zipfile.ZipFile(archive) as z:
            z.extractall(test)
        env = {k: v for k, v in os.environ.items() if k not in ('PYTHONHOME', 'PYTHONPATH', 'VIRTUAL_ENV')}
        env['PATH'] = str(Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32')
        report = test / '검사 결과.json'
        exe = test / 'LectureStudio' / 'LectureStudio.exe'
        r = subprocess.run([str(exe), '--self-test', str(report)], cwd=exe.parent, env=env, timeout=600)
        d = json.loads(report.read_text(encoding='utf-8'))
        fails = [c for k in ('math', 'studio') for c in (d[k] or {}).get('checks', []) if not c.startswith('ok')]
        print(f"      exit {r.returncode}, 통과 {d['passed']}, 버전 {d['version']}, 실행 파일 {d['frozen']}, Word {d['word']}, PDF {d['pdf']}, 검사 수 {[len((d[k] or {}).get('checks', [])) for k in ('math', 'studio')]}")
        if fails or not d['passed']:
            print('실패한 검사:', fails or d.get('error'))
            sys.exit(1)
    finally:
        shutil.rmtree(test, ignore_errors=True)
    print('완료:', archive)


if __name__ == '__main__':
    main()
