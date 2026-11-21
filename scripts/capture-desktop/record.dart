import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

final surface = GlobalKey();
Element? elementWhere(bool Function(Widget) match) {
  Element? found;
  void visit(Element e) {
    if (found != null || (e.widget is Offstage && (e.widget as Offstage).offstage)) return;
    if (match(e.widget)) { found = e; return; }
    e.visitChildren(visit);
  }
  visit(surface.currentContext! as Element);
  return found;
}
void press(String label) {
  final e = elementWhere((w) => w is Text && w.data == label);
  ButtonStyleButton? button;
  e?.visitAncestorElements((a){ if(a.widget is ButtonStyleButton){button=a.widget as ButtonStyleButton; return false;}return true;});
  if(button?.onPressed==null) throw StateError('Button not available: $label');
  button!.onPressed!();
}
Future<void> record(Widget app, void Function(int frame) advance) async {
  final dir=Directory(Platform.environment['CAPTURE_OUT']!);
  runApp(RepaintBoundary(key:surface,child:app));
  try {
    await Future<void>.delayed(const Duration(seconds:4));
    final clock=Stopwatch()..start();
    for(var n=0;n<180;n++) {
      advance(n);
      await WidgetsBinding.instance.endOfFrame;
      final boundary=surface.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final im=await boundary.toImage(pixelRatio:1);
      final bytes=await im.toByteData(format:ui.ImageByteFormat.png); im.dispose();
      File('${dir.path}/${n.toString().padLeft(4,'0')}.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      final delay=(n+1)*100-clock.elapsedMilliseconds;
      if(delay>0) await Future<void>.delayed(Duration(milliseconds:delay));
    }
    exit(0);
  } catch(e,st) { File('${dir.path}/error.txt').writeAsStringSync('$e\n$st'); exit(1); }
}
