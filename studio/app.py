"""공업수학 시각화 프로그램 창입니다. 화면은 web/ 폴더의 페이지이며 인터넷을 쓰지 않습니다.

실행: python app.py
검사: python app.py --self-test report.json
"""
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.dom import minidom
from PySide6.QtCore import QMarginsF, QStandardPaths, QTimer, QUrl
from PySide6.QtGui import QDesktopServices, QPageLayout, QPageSize
from PySide6.QtPdf import QPdfDocument
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox
from PySide6.QtWebEngineCore import QWebEngineDownloadRequest, QWebEnginePage, QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView

ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
WEB = ROOT / 'web'


def app_version():
    """web/version.js의 APP_VERSION을 읽습니다."""
    match = re.search(r"APP_VERSION = '([^']+)'", (WEB / 'version.js').read_text(encoding='utf-8'))
    return match.group(1) if match else '?'


class StudioWindow(QMainWindow):
    def __init__(self, profile):
        super().__init__()
        self.setWindowTitle(f'공업수학 시각화 v{app_version()}')
        self.resize(1440, 900)
        self.view = QWebEngineView(self)
        self.page = QWebEnginePage(profile, self.view)
        settings = self.page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)
        self.page.fullScreenRequested.connect(self.toggle_full_screen)
        profile.downloadRequested.connect(self.save_document)
        self.page.printRequested.connect(self.save_pdf)
        self.page.pdfPrintingFinished.connect(self.pdf_saved)
        self.doc_target = None     # 자체 검사가 대화상자 없이 저장할 경로입니다.
        self.doc_finished = None
        self.pdf_target = None
        self.pdf_finished = None
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
        elif ok:
            # Word 문서는 엽니다. 열 프로그램이 없으면 저장했다는 것만 알립니다.
            opened = QDesktopServices.openUrl(QUrl.fromLocalFile(str(target))) if target.suffix == '.docx' else True
            self.page.runJavaScript(f'window.studioSaved?.({json.dumps(str(target))}, {json.dumps(opened)})')
        else:
            QMessageBox.warning(self, '저장 실패', f'{target.name}을 저장하지 못했습니다. 같은 이름의 파일이 다른 프로그램에서 열려 있으면 닫고 다시 시도하십시오.')

    def save_pdf(self):
        """페이지의 window.print()를 받아 인쇄용 문서를 PDF로 저장합니다."""
        name = self.page.title() or '공업수학 예제'
        path = self.pdf_target or QFileDialog.getSaveFileName(self, 'PDF로 저장', f'{name}.pdf', 'PDF (*.pdf)')[0]
        if not path:
            self.page.runJavaScript('window.studioPrintDone?.()')
            return
        self.pdf_path = str(Path(path).with_suffix('.pdf'))
        layout = QPageLayout(QPageSize(QPageSize.PageSizeId.A4), QPageLayout.Orientation.Portrait, QMarginsF(16, 18, 16, 18), QPageLayout.Unit.Millimeter)
        self.page.printToPdf(self.pdf_path, layout)

    def pdf_saved(self, path, ok):
        self.page.runJavaScript('window.studioPrintDone?.()')
        if self.pdf_finished:
            self.pdf_finished(ok, Path(path))
        elif ok:
            opened = QDesktopServices.openUrl(QUrl.fromLocalFile(path))
            self.page.runJavaScript(f'window.studioSaved?.({json.dumps(path)}, {json.dumps(opened)})')
        else:
            QMessageBox.warning(self, '저장 실패', 'PDF를 저장하지 못했습니다. 같은 이름의 파일이 열려 있으면 닫고 다시 시도하십시오.')

    def open_page(self, name, query=''):
        url = QUrl.fromLocalFile(str(WEB / name))
        if query:
            url.setQuery(query)
        self.view.load(url)

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
        svgs = sum(name.endswith('.svg') for name in archive.namelist())
    ok = all(t in xml for t in ('개념 정리', '직교성', '예제 1', '구하시오', '풀이', 'svgBlip')) and xml.count('<m:oMath>') > 10 and images == 4 and svgs == 2
    return {'equations': xml.count('<m:oMath>'), 'images': images // 2, 'svg': svgs} if ok else None


def run_self_test(window, application, report_path):
    """계산 검사(test.html), 화면 검사(studio.html), Word 출력을 차례로 실행해 보고서를 씁니다."""
    report = {'passed': False, 'version': app_version(), 'frozen': bool(getattr(sys, 'frozen', False)), 'math': None, 'studio': None, 'word': None, 'pdf': None}

    def finish():
        report['passed'] = all(report[key] and report[key]['passed'] for key in ('math', 'studio')) and bool(report['word']) and bool(report['pdf'])
        Path(report_path).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        application.exit(0 if report['passed'] else 1)

    def on_math_loaded(_ok):
        window.page.runJavaScript('JSON.stringify(window.RESULTS ?? null)', 0, math_done)

    def math_done(value):
        report['math'] = json.loads(value) if value else {'passed': False, 'checks': ['계산 검사가 값을 돌려주지 않았습니다.']}
        window.view.loadFinished.disconnect(on_math_loaded)
        window.view.loadFinished.connect(on_studio_loaded)
        window.open_page('studio.html', 'selftest')

    def on_studio_loaded(_ok):
        QTimer.singleShot(300, wait_selftest)

    def wait_selftest():
        # selftest.js는 페이지가 열린 뒤 따로 불러오므로, 준비될 때까지 기다립니다.
        window.page.runJavaScript('typeof window.STUDIO_SELFTEST', 0, lambda kind: window.page.runJavaScript('JSON.stringify(window.STUDIO_SELFTEST())', 0, studio_done) if kind == 'function' else QTimer.singleShot(200, wait_selftest))

    def studio_done(value):
        report['studio'] = json.loads(value) if value else {'passed': False, 'checks': ['화면 검사가 값을 돌려주지 않았습니다.']}
        # Word 출력 단추를 실제로 눌러 파일이 저장되는지 확인합니다.
        window.doc_target = str(Path(report_path).with_name(Path(report_path).stem + ' 출력.docx'))
        window.doc_finished = word_done
        window.page.runJavaScript("document.getElementById('wordBtn').click()")

    def word_done(ok, target):
        report['word'] = check_docx(target) if ok else None
        # PDF 출력 단추도 눌러 봅니다. 앱 화면이 아니라 문제 문서가 저장되는지 글자로 확인합니다.
        window.pdf_target = str(Path(report_path).with_name(Path(report_path).stem + ' 출력.pdf'))
        window.pdf_finished = pdf_done
        window.page.runJavaScript("S.fakeDownload = false; document.getElementById('pdfBtn').click()")

    def pdf_done(ok, target):
        document = QPdfDocument(window)
        document.load(str(target))
        text = ' '.join(document.getAllText(i).text() for i in range(document.pageCount()))
        report['pdf'] = {'pages': document.pageCount()} if ok and '예제 1' in text and '구하시오' in text and '그래프 담기' not in text else None
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
