"""Instrument temporary upstream checkouts, not the distributed applications."""
from pathlib import Path
import os, sys
here=Path(__file__).resolve().parent
kind=sys.argv[1]
if kind=='books':
    p=Path('tools/Win7BookManagement.UiTools/UiSnapshotGenerator.cs'); s=p.read_text(encoding='utf-8-sig'); i=s.index('                Capture('); j=s.index('                return 0;',i)
    # Record the same real form for the whole take, using the project's own
    # seeded database and WinForms rendering method used in its snapshot tests.
    s=s[:i]+'''                using(var host=new Panel()) using(var form=new MainForm(services)) {
                    var size=new Size(1280, 768); host.Size=size; host.CreateControl();
                    form.TopLevel=false; form.FormBorderStyle=FormBorderStyle.None;
                    host.Controls.Add(form); form.Show(); Application.DoEvents();
                    SetWindowPos(form.Handle,IntPtr.Zero,0,0,size.Width,size.Height,SwpNoActivate|SwpNoZOrder);
                    var timer=System.Diagnostics.Stopwatch.StartNew();
                    for(int n=0;n<180;n++) {
                        if(n==45)form.Navigate("books"); if(n==93)form.Navigate("inventory"); if(n==138)form.Navigate("reports");
                        Application.DoEvents(); form.PerformLayout(); ForceEmbeddedFormBounds(form);
                        using(var image=new Bitmap(size.Width,size.Height)) {host.DrawToBitmap(image,new Rectangle(Point.Empty,size)); image.Save(Path.Combine(outputDirectory,n.ToString("D4")+".png"),ImageFormat.Png);}
                        while(timer.ElapsedMilliseconds<(n+1)*100) { Application.DoEvents(); System.Threading.Thread.Sleep(8); }
                    }
                }
'''+s[j:];p.write_text(s,encoding='utf-8-sig');sys.exit()
Path('lib/capture_record.dart').write_bytes((here/'record.dart').read_bytes())
if kind=='ktv':
    Path('lib/capture_main.dart').write_bytes((here/'ktv.dart').read_bytes());sys.exit()
# Use the native Flutter workspace with upstream's isolated file/CLI fixtures.
# Only the data source and the file picker are replaced, not the screens.
s=Path('test/desktop_workflow_test.dart').read_text(); imports=s[:s.index('void main()')].replace("import 'package:flutter_test/flutter_test.dart';", "import 'capture_record.dart';\nimport 'theme/scribe_theme.dart';")
body='''Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final root=Directory.systemTemp.createTempSync('ScribeStudio');
  final source=File('${root.path}/河岸手记.pdf'); final bytes=[37,80,68,70,45,49,46,55]; source.writeAsBytesSync(bytes);
  final fs=_FakeWorkspaceFileSystem(sourcePath:source.path,sourceBytes:bytes);
  final cli=_FakeCliExecutor(sourcePath:source.path,sourceHash:sha256.convert(bytes).toString(),fileSystem:fs,processResults:[0],exportResults:[0],reviewItems:[_reviewItem(0,'河岸的灯影穿过薄雾。','河岸的灯影穿过簿雾。')],holdProcess:false,runtimeReady:true,runtimeError:null,processError:'');
  final w=UnifiedWorkspace(cliExecutor:cli,fileSystem:fs,filePicker:_FakeDesktopFilePicker(files:[source.path],directories:[root.path]),settingsStore:_MemorySettingsStore(),backendResolver:DesktopBackendResolver(fileExists:(_) async=>false));
  void tab(int i) => (elementWhere((w)=>w is NavigationRail)!.widget as NavigationRail).onDestinationSelected!(i);
  await record(MaterialApp(debugShowCheckedModeBanner:false,theme:ScribeTheme.light,home:w),(n){
    if(n==25) press('导入书籍'); if(n==43) tab(1); if(n==62) press('开始处理'); if(n==85) tab(2); if(n==113) press('填入 OCR 1'); if(n==151) tab(4);
  });
}
'''
Path('lib/capture_main.dart').write_text(imports+body+s[s.index('Map<String, Object?> _reviewItem('):],encoding='utf-8');
