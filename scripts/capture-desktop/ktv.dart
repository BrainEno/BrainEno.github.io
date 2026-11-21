import 'package:flutter/material.dart';
import 'app/app.dart';
import 'app/app_services.dart';
import 'features/project/domain/models/lyric_document.dart';
import 'features/project/domain/models/project_manifest.dart';
import 'capture_record.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final services=AppServices.instance; services.initialize();
  final repo=services.projectRepository;
  await repo.createProject(name:'夜班列车',artist:'纸灯乐队');
  final p=await repo.createProject(name:'沿河灯火',artist:'纸灯乐队',album:'夜间录音');
  final words=['桥上还留着雨声','灯火沿着河岸轻轻摇晃','等末班列车经过','我们把回声唱给月亮'];
  await repo.updateProject(p.copyWith(status:ProjectStatus.editing,currentStage:ProcessingStage.lyricsEdited,lyricDocument:LyricDocument(language:'zh',lines:[for(int i=0;i<words.length;i++) LyricLine(text:words[i],startTime:Duration(seconds:i*4),endTime:Duration(seconds:i*4+3))])));
  await record(ElysiumPlayerApp(services:services),(n){
    if(n!=48 && n!=100 && n!=157)return;
    final nav=elementWhere((w)=>w is Navigator) as StatefulElement;
    (nav.state as NavigatorState).pushNamed(n==48?'/project/${p.id}':n==100?'/project/${p.id}/lyrics':'/dashboard');
  });
}
