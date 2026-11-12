"""공업수학 시각화 프로그램 창입니다. 화면은 web/ 폴더의 페이지이며 인터넷을 쓰지 않습니다.

실행: python app.py
검사: python app.py --self-test report.json
"""
import json
import sys
import zipfile
from pathlib import Path
from xml.dom import minidom
from PySide6.QtCore import QStandardPaths, QTimer, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox
from PySide6.QtWebEngineCore import QWebEngineDownloadRequest, QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView

ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
WEB = ROOT / 'web'


class StudioWindow(QMainWindow):
    def __init__(self, profile):
        super().__init__()
        self.setWindowTitle('공업수학 시각화')
        self.resize(1440, 900)
        self.view = QWebEngineView(self)
        self.page = QWebEnginePage(profile, self.view)
        settings = self.page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        self.page.fullScreenRequested.connect(self.toggle_full_screen)
        profile.downloadRequested.connect(self.save_document)
        self.doc_target = None     # 자체 검사가 대화상자 없이 저장할 경로입니다.
        self.doc_finished = None
        self.view.setPage(self.page)
        self.setCentralWidget(self.view)

    def toggle_full_screen(self, request):
        request.accept()
        self.showFullScreen() if request.toggleOn() else self.showNormal()

    def save_document(self, download):
        """페이지가 만든 Word 문서나 예제 모음(.json)을 원하는 곳에 저장합니다. Word 문서는 저장 뒤 엽니다."""
        name = download.suggestedFileName()
        suffix = '.json' if name.lower().endswith('.json') else '.docx'
        title, kind = ('예제 모음 저장', '예제 모음 (*.json)') if suffix == '.json' else ('Word 문서로 저장', 'Word 문서 (*.docx)')
        path = self.doc_target or QFileDialog.getSaveFileName(self, title, name, kind)[0]
        if not path:
            download.cancel()
            return
        target = Path(path).with_suffix(suffix)
        download.setDownloadDirectory(str(target.parent))
        download.setDownloadFileName(target.name)
        download.isFinishedChanged.connect(lambda: self.document_saved(download, target))
        download.accept()

    def document_saved(self, download, target):
        ok = download.state() == QWebEngineDownloadRequest.DownloadState.DownloadCompleted
        if self.doc_finished:
            self.doc_finished(ok, target)
        elif ok and target.suffix == '.docx':
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(target)))
        else:
            QMessageBox.warning(self, '저장 실패', f'{target.name}을 저장하지 못했습니다. 같은 이름의 파일이 다른 프로그램에서 열려 있으면 닫고 다시 시도하십시오.')

    def open_page(self, name):
        self.view.load(QUrl.fromLocalFile(str(WEB / name)))

    def closeEvent(self, event):
        # 프로필보다 먼저 페이지를 지워야 종료 시 경고가 나지 않습니다.
        self.view.setPage(None)
        self.page.deleteLater()
        super().closeEvent(event)


def check_docx(target):
    """Word 파일의 모든 XML이 올바른지, 본문에 문제·풀이·수식·그림이 있는지 확인합니다."""
    with zipfile.ZipFile(target) as archive:
        for name in archive.namelist():
            if name.endswith(('.xml', '.rels')):
                minidom.parseString(archive.read(name))
        xml = archive.read('word/document.xml').decode('utf-8')
        images = sum(name.startswith('word/media/') for name in archive.namelist())
    ok = all(t in xml for t in ('개념 정리', '직교성', '예제 1', '구하시오', '풀이')) and xml.count('<m:oMath>') > 10 and images == 2
    return {'equations': xml.count('<m:oMath>'), 'images': images} if ok else None


def run_self_test(window, application, report_path):
    """계산 검사(test.html), 화면 검사(studio.html), Word 출력을 차례로 실행해 보고서를 씁니다."""
    report = {'passed': False, 'frozen': bool(getattr(sys, 'frozen', False)), 'math': None, 'studio': None, 'word': None}

    def finish():
        report['passed'] = all(report[key] and report[key]['passed'] for key in ('math', 'studio')) and bool(report['word'])
        Path(report_path).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        application.exit(0 if report['passed'] else 1)

    def on_math_loaded(_ok):
        window.page.runJavaScript('JSON.stringify(window.RESULTS ?? null)', 0, math_done)

    def math_done(value):
        report['math'] = json.loads(value) if value else {'passed': False, 'checks': ['계산 검사가 값을 돌려주지 않았습니다.']}
        window.view.loadFinished.disconnect(on_math_loaded)
        window.view.loadFinished.connect(on_studio_loaded)
        window.open_page('studio.html')

    def on_studio_loaded(_ok):
        QTimer.singleShot(300, lambda: window.page.runJavaScript('JSON.stringify(window.STUDIO_SELFTEST())', 0, studio_done))

    def studio_done(value):
        report['studio'] = json.loads(value) if value else {'passed': False, 'checks': ['화면 검사가 값을 돌려주지 않았습니다.']}
        # Word 출력 단추를 실제로 눌러 파일이 저장되는지 확인합니다.
        window.doc_target = str(Path(report_path).with_name(Path(report_path).stem + ' 출력.docx'))
        window.doc_finished = word_done
        window.page.runJavaScript("document.getElementById('wordBtn').click()")

    def word_done(ok, target):
        report['word'] = check_docx(target) if ok else None
        finish()

    window.view.loadFinished.connect(on_math_loaded)
    window.open_page('test.html')
    QTimer.singleShot(120000, lambda: (report.update(error='시간 초과'), finish()))


def main():
    application = QApplication(sys.argv)
    application.setApplicationName('EngineeringMathLectureStudio')
    profile = QWebEngineProfile('studio', application)
    store = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppDataLocation)) / 'profile'
    profile.setPersistentStoragePath(str(store))
    window = StudioWindow(profile)
    window.show()
    if '--self-test' in sys.argv:
        run_self_test(window, application, sys.argv[sys.argv.index('--self-test') + 1])
    else:
        window.open_page('studio.html')
    code = application.exec()
    del window
    return code


if __name__ == '__main__':
    raise SystemExit(main())
