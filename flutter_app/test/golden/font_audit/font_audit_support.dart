// Throwaway font audit (16 Oct 2026): renders screens at 360x800 with text scale 1.0 and 1.3,
// Night and Day, writes the images to MM_AUDIT_DIR and scans each frame for clipped text, overflow
// reports, overlapping text and tap targets under 48 dp. It asserts nothing; it only reports.
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fonts.dart';

const Size kAuditPhone = Size(360, 800);
const Size kAuditTall = Size(360, 2600);

String get auditDir => Platform.environment['MM_AUDIT_DIR'] ?? 'build/font_audit';

/// Writes whatever `matchesGoldenFile` is handed into the audit folder and always passes.
class _Sink extends GoldenFileComparator {
  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    await update(golden, imageBytes);
    return true;
  }

  @override
  Future<void> update(Uri golden, Uint8List imageBytes) async {
    final f = File('$auditDir/images/${golden.pathSegments.last}');
    f.parent.createSync(recursive: true);
    f.writeAsBytesSync(imageBytes);
  }
}

typedef AuditPump = Future<void> Function(WidgetTester tester, Brightness brightness, double scale, Size size);

void _log(String line) {
  final f = File('$auditDir/scan.txt');
  f.parent.createSync(recursive: true);
  f.writeAsStringSync('$line\n', mode: FileMode.append);
}

/// Registers the audit of one screen: four renders (scale 1.0 and 1.3, Night and Day), plus two
/// tall Night renders (the whole scroll, for the scan) when [tall].
void audit(String id, AuditPump pump, {bool tall = false, Size tallSize = kAuditTall}) {
  for (final scale in [1.0, 1.3]) {
    for (final b in [Brightness.dark, Brightness.light]) {
      testWidgets('$id ${b.name} x$scale', (tester) => _one(tester, id, b, scale, kAuditPhone, pump), timeout: const Timeout(Duration(minutes: 4)));
    }
    if (tall) {
      testWidgets('${id}_tall dark x$scale', (tester) => _one(tester, '${id}_tall', Brightness.dark, scale, tallSize, pump), timeout: const Timeout(Duration(minutes: 4)));
    }
  }
}

void auditSetUp() {
  setUpAll(() async {
    goldenFileComparator = _Sink();
    await loadAppFonts();
    await loadMaterialIconFont();
  });
}

Future<void> _one(WidgetTester tester, String id, Brightness b, double scale, Size size, AuditPump pump) async {
  final tag = '${id}__${b == Brightness.dark ? 'night' : 'day'}__x${(scale * 10).round()}';
  final errors = <FlutterErrorDetails>[];
  final previous = FlutterError.onError;
  FlutterError.onError = errors.add;
  final handle = tester.ensureSemantics();
  try {
    try {
      await pump(tester, b, scale, size);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
      await tester.pump(const Duration(milliseconds: 100));
      await expectLater(find.byType(MaterialApp).first, matchesGoldenFile('$tag.png'));
    } catch (e, st) {
      _log('$tag|HARNESS|${e.toString().split('\n').first} ${st.toString().split('\n').take(3).join(' / ')}');
    }
    for (final d in errors) {
      final text = d.exceptionAsString();
      final first = text.split('\n').first;
      final loc = RegExp(r'file:///[^\s]*lib/[^\s]+').allMatches(d.toString()).map((m) => m.group(0)!.split('/lib/').last).toSet().take(4).join(' ; ');
      if (first.contains('overflowed')) {
        _log('$tag|OVERFLOW|$first | $loc');
      } else {
        _log('$tag|ERROR|${first.length > 160 ? first.substring(0, 160) : first} | $loc');
      }
    }
    try {
      for (final line in _scan(tester, size)) {
        _log('$tag|$line');
      }
    } catch (e, st) {
      _log('$tag|SCANFAIL|$e ${st.toString().split('\n').take(2).join(' / ')}');
    }
  } finally {
    FlutterError.onError = previous;
    handle.dispose();
  }
}

bool _hidden(RenderObject o) {
  for (RenderObject? a = o; a != null; a = a.parent) {
    if (a is RenderOffstage && a.offstage) return true;
    if (a is RenderOpacity && a.opacity == 0) return true;
    if (a is RenderAnimatedOpacity && a.opacity.value == 0) return true;
  }
  return false;
}

Rect _global(RenderBox box) => MatrixUtils.transformRect(box.getTransformTo(null), Offset.zero & box.size);

List<String> _scan(WidgetTester tester, Size viewport) {
  final out = <String>[];
  final screen = Offset.zero & viewport;
  final paras = <(RenderParagraph, Rect, String)>[];
  for (final o in tester.allRenderObjects) {
    if (o is! RenderParagraph || !o.attached || !o.hasSize || o.size.isEmpty) continue;
    final text = o.text.toPlainText().replaceAll('￼', '').trim();
    if (text.isEmpty || _hidden(o)) continue;
    final r = _global(o);
    if (!r.overlaps(screen)) continue;
    paras.add((o, r, text));
  }
  String short(String t) => (t.length > 54 ? '${t.substring(0, 54)}...' : t).replaceAll('\n', ' ');
  for (final (p, r, text) in paras) {
    if (p.didExceedMaxLines) out.add('TRUNCATED|"${short(text)}" ${r.width.round()}x${r.height.round()} at ${r.left.round()},${r.top.round()}|${_where(p)}');
    if (!p.didExceedMaxLines && p.textSize.width > p.size.width + 0.6) out.add('WIDE|"${short(text)}" text ${p.textSize.width.round()} in ${p.size.width.round()}|${_where(p)}');
    if (r.left < -0.6 || r.right > viewport.width + 0.6) out.add('OFFSCREEN-X|"${short(text)}" ${r.left.round()}..${r.right.round()}|${_where(p)}');
    for (RenderObject? a = p.parent; a != null; a = a.parent) {
      if (a is RenderClipRect || a is RenderClipRRect || a is RenderClipPath || a is RenderClipOval) {
        final box = a as RenderBox;
        final c = _global(box);
        final inter = r.intersect(c);
        if (inter.width < r.width - 1.5 || inter.height < r.height - 1.5) {
          out.add('CLIPPED|"${short(text)}" text ${r.width.round()}x${r.height.round()} inside clip ${c.width.round()}x${c.height.round()} (${a.runtimeType})|${_where(p)}');
          break;
        }
      }
    }
  }
  for (var i = 0; i < paras.length; i++) {
    for (var j = i + 1; j < paras.length; j++) {
      final a = paras[i].$2, b = paras[j].$2;
      final inter = a.intersect(b);
      if (inter.width <= 1 || inter.height <= 1) continue;
      final small = math.min(a.width * a.height, b.width * b.height);
      if (inter.width * inter.height > 0.25 * small) {
        out.add('OVERLAP|"${short(paras[i].$3)}" x "${short(paras[j].$3)}" ${inter.width.round()}x${inter.height.round()}|${_where(paras[i].$1)} ; ${_where(paras[j].$1)}');
      }
    }
  }
  // Tap targets under 48 dp.
  final root = tester.binding.pipelineOwner.semanticsOwner?.rootSemanticsNode;
  if (root != null) {
    final dpr = tester.view.devicePixelRatio;
    void walk(SemanticsNode n, Matrix4 parent) {
      final m = parent.clone();
      if (n.transform != null) m.multiply(n.transform!);
      final data = n.getSemanticsData();
      final tappable = data.hasAction(SemanticsAction.tap) || data.hasAction(SemanticsAction.longPress);
      if (tappable && !n.isMergedIntoParent && !n.isInvisible && !data.flagsCollection.isHidden) {
        final g = MatrixUtils.transformRect(m, n.rect);
        final w = g.width / dpr, h = g.height / dpr;
        final center = g.center / dpr;
        if (Rect.fromLTWH(g.left / dpr, g.top / dpr, w, h).overlaps(screen) && (w < 47.5 || h < 47.5)) {
          out.add('TAP<48|"${short(n.label.isNotEmpty ? n.label : n.value)}" ${w.toStringAsFixed(1)}x${h.toStringAsFixed(1)} at ${center.dx.round()},${center.dy.round()}|${_whereAt(tester, center)}');
        }
      }
      n.visitChildren((c) {
        walk(c, m);
        return true;
      });
    }
    walk(root, Matrix4.identity());
  }
  return out;
}

String _loc(Element e) {
  try {
    final map = e.toDiagnosticsNode().toJsonMap(InspectorSerializationDelegate(service: WidgetInspectorService.instance));
    final cl = map['creationLocation'];
    if (cl is Map) {
      final f = '${cl['file']}';
      final i = f.indexOf('/lib/');
      return '${i >= 0 ? f.substring(i + 1) : f}:${cl['line']}';
    }
  } catch (_) {}
  return '';
}

/// The nearest widgets from this app's lib that built [o], innermost first.
String _where(RenderObject o) {
  final creator = o.debugCreator;
  if (creator is! DebugCreator) return '?';
  return _chain(creator.element);
}

String _chain(Element start) {
  final seen = <String>[];
  void add(Element e) {
    final l = _loc(e);
    if (l.startsWith('lib/') && !seen.contains(l)) seen.add('${e.widget.runtimeType} $l');
  }

  add(start);
  var depth = 0;
  start.visitAncestorElements((e) {
    add(e);
    depth++;
    return depth < 14 && seen.length < 4;
  });
  return seen.join(' < ');
}

String _whereAt(WidgetTester tester, Offset logical) {
  final result = HitTestResult();
  tester.binding.hitTestInView(result, logical, tester.view.viewId);
  for (final e in result.path) {
    final t = e.target;
    if (t is RenderObject) {
      final c = t.debugCreator;
      if (c is DebugCreator) {
        final s = _chain(c.element);
        if (s.isNotEmpty) return s;
      }
    }
  }
  return '?';
}
