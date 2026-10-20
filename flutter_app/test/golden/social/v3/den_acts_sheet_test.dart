// Frame sheets of the den's event acts (MOB-MINIMAL 4.2) on the real den: a friend joining and the Mob's cheer, Night
// and Day, plus the reduced-motion join. For looking at the motion, not a golden: it runs only when asked,
//   flutter test test/golden/social/v3/den_acts_sheet_test.dart --dart-define=DENACTS_SHEET=<folder>
// and writes denacts-{join,reaction}-{night,day}.png and denacts-join-reduced-night.png to that folder.

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/social/data/mob_repository.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_fake_server.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/den_acts.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_manifest.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;
import 'den_kit.dart';

const String _out = String.fromEnvironment('DENACTS_SHEET');
const String _meher = MobV3FakeServer.newcomerId;

const List<double> _joinAt = [0, 160, 320, 480, 640, 800, 960, 1050, 1240, 1400, 1700, 2300];
const List<double> _cheerAt = [0, 90, 180, 270, 360, 450, 600, 750, 900, 1100, 1300, 1560];
const List<double> _reducedAt = [0, 30, 60, 90, 120];

Finder _player(String id) => find.byKey(ValueKey('den-act-$id'));

Future<DenActPlayer?> _untilAct(WidgetTester t, DenActKind kind) async {
  for (var i = 0; i < 600; i++) {
    if (_player(_meher).evaluate().isNotEmpty) {
      final p = t.widget<DenActPlayer>(_player(_meher));
      if (p.actId != 0 && p.kind == kind) return p;
    }
    await t.pump(const Duration(milliseconds: 16));
  }
  return null;
}

/// Steps the act to each of [times] and captures the stage band (the floor, the Folds, the tags and a sticker's rise).
Future<List<(String, ui.Image)>> _frames(WidgetTester t, DenActKind kind, List<double> times, double length, String label) async {
  final p = await _untilAct(t, kind);
  expect(p, isNotNull, reason: 'the $label act started');
  expect(p!.clock!.value, lessThan(0.05), reason: 'caught at its start');
  await t.pump();
  final out = <(String, ui.Image)>[];
  final room = t.getRect(find.byType(DenStage));
  for (final ms in times) {
    final now = t.widget<DenActPlayer>(_player(_meher)).clock!.value * length;
    if (ms > now) await t.pump(Duration(microseconds: ((ms - now) * 1000).round()));
    final shot = await t.runAsync(() => captureImage(t.element(find.byType(MaterialApp))));
    out.add(('${ms.round()} ms', _crop(shot!, room, t.view.physicalSize.width / t.view.devicePixelRatio)));
  }
  return out;
}

ui.Image _crop(ui.Image shot, Rect room, double logicalWidth) {
  final k = shot.width / logicalWidth;
  // The whole room: the header, the pennant, the desk, the floor and the name tags.
  final src = Rect.fromLTRB(0, room.top * k, room.width * k, room.bottom * k);
  final rec = ui.PictureRecorder();
  Canvas(rec).drawImageRect(shot, src, Rect.fromLTWH(0, 0, room.width, room.height), Paint()..filterQuality = FilterQuality.high);
  return rec.endRecording().toImageSync(room.width.round(), room.height.round());
}

Future<void> _sheet(WidgetTester t, String file, String title, List<(String, ui.Image)> frames, {required bool night}) async {
  const cols = 6;
  final cw = frames.first.$2.width.toDouble();
  final ch = frames.first.$2.height.toDouble();
  const gap = 10.0;
  const label = 26.0;
  const head = 44.0;
  final rows = (frames.length / cols).ceil();
  final w = cols * cw + (cols + 1) * gap;
  final h = head + rows * (ch + label + gap) + gap;
  final rec = ui.PictureRecorder();
  final c = Canvas(rec);
  final bg = night ? const Color(0xFF0E0D0B) : const Color(0xFFF4EFE6);
  final ink = night ? const Color(0xFFEDE5D3) : const Color(0xFF1E1B15);
  c.drawRect(Rect.fromLTWH(0, 0, w, h), Paint()..color = bg);
  void text(String s, Offset at, double size, FontWeight weight) {
    final b = ui.ParagraphBuilder(ui.ParagraphStyle(fontFamily: 'HankenGrotesk', fontSize: size, fontWeight: weight))
      ..pushStyle(ui.TextStyle(color: ink, fontFamily: 'HankenGrotesk', fontSize: size, fontWeight: weight))
      ..addText(s);
    final para = b.build()..layout(ui.ParagraphConstraints(width: w));
    c.drawParagraph(para, at);
  }

  text(title, const Offset(gap, 12), 18, FontWeight.w700);
  for (var i = 0; i < frames.length; i++) {
    final x = gap + (i % cols) * (cw + gap);
    final y = head + (i ~/ cols) * (ch + label + gap);
    c.drawImage(frames[i].$2, Offset(x, y), Paint());
    text(frames[i].$1, Offset(x, y + ch + 4), 14, FontWeight.w600);
  }
  final img = rec.endRecording().toImageSync(w.round(), h.round());
  final bytes = await t.runAsync(() => img.toByteData(format: ui.ImageByteFormat.png));
  Directory(_out).createSync(recursive: true);
  File('$_out/$file').writeAsBytesSync(bytes!.buffer.asUint8List());
}

/// The demo den: Chai Circle in the 'heavy' scenario, where Meher joins and says "Let's go" (the fixture's arrival). This
/// phone last saw the four of them an hour ago.
/// In reduced motion the den is in at once, so Meher arrives while it is open (a later read), not before.
Future<void> _pump(WidgetTester t, {required Brightness b, bool reduced = false}) async {
  final server = v3Server(scenario: 'heavy');
  if (!reduced) server.arrive();
  final phone = MemoryPrefsStore()
    ..values[DenActBook.keyFor(MobV3FakeServer.chaiId)] = DenActMemory(members: const {'AARAV0000001', 'RIYA00000002', 'KABIR0000003', 'ZOYA00000004'}, reactionsUpTo: v3Now.subtract(const Duration(hours: 1))).encode();
  await pumpDen(t, server, brightness: b, reduced: reduced, prefs: phone, height: 900);
  // Every still the acts can show, decoded on the real event loop (the den warms them in the beat before an act; a
  // test's fake clock cannot).
  await t.runAsync(() async {
    final m = FoldManifest.cached!;
    final context = t.element(find.byType(DenStage));
    for (final k in const [FoldKey.dart, FoldKey.patang, FoldKey.naav, FoldKey.cutting, FoldKey.kandil]) {
      for (final pose in FoldPose.values) {
        final still = m[k]?.still(pose);
        if (still != null) await precacheImage(AssetImage(still.file), context).timeout(const Duration(seconds: 3), onTimeout: () {});
      }
    }
  });
  if (reduced) {
    await t.pump(const Duration(seconds: 1));
    server.arrive();
    ProviderScope.containerOf(t.element(find.byType(DenStage))).read(mobRepositoryProvider.notifier).accept(await server.den());
    await t.pump();
  }
}

void main() {
  setUpGoldenFonts();

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';
    testWidgets('den acts frame sheet, $tag', skip: _out.isEmpty, (t) async {
      await _pump(t, b: b);
      final join = await _frames(t, DenActKind.join, _joinAt, JoinAct.total, 'join');
      await _sheet(t, 'denacts-join-$tag.png', 'A friend joins: Meher hops in (${JoinAct.total.round()} ms)', join, night: b == Brightness.dark);
      final cheering = t.widget<DenActPlayer>(_player(_meher)).members;
      final cheer = await _frames(t, DenActKind.reaction, _cheerAt, ReactionAct.totalFor(4), 'reaction');
      await _sheet(t, 'denacts-reaction-$tag.png', 'A reaction: Meher says "Let\'s go", the Mob cheers ($cheering Folds, ${ReactionAct.totalFor(4).round()} ms)', cheer, night: b == Brightness.dark);
      await t.pump(const Duration(seconds: 3));
    });
  }

  testWidgets('den acts frame sheet, reduced motion', skip: _out.isEmpty, (t) async {
    await _pump(t, b: Brightness.dark, reduced: true);
    final join = <(String, ui.Image)>[];
    final p = await _untilAct(t, DenActKind.join);
    expect(p, isNotNull, reason: 'the reduced join started');
    {
      await t.pump();
      final room = t.getRect(find.byType(DenStage));
      for (final ms in _reducedAt) {
        final now = t.widget<DenActPlayer>(_player(_meher)).clock!.value * 120;
        if (ms > now) await t.pump(Duration(microseconds: ((ms - now) * 1000).round()));
        final shot = await t.runAsync(() => captureImage(t.element(find.byType(MaterialApp))));
        join.add(('${ms.round()} ms', _crop(shot!, room, t.view.physicalSize.width / t.view.devicePixelRatio)));
      }
      await _sheet(t, 'denacts-join-reduced-night.png', 'Reduced motion: Meher cross-fades into the seat (120 ms)', join, night: true);
    }
    await t.pump(const Duration(seconds: 3));
  });
}
