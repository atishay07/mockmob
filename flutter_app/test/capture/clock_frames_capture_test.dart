// Frame sequences of the Full mock's stopwatch (owner 19 Oct, H4: "You can keep the clock
// animation from the full mockup card. Just fix it."), written as PNG contact sheets for review.
//
// Off by default: it writes files, so it runs only with MM_CLOCK_FRAMES set to an output folder:
//   MM_CLOCK_FRAMES=../../mockmob-next/tmp/design-1019pm/clock/after flutter test test/capture
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';

import '../helpers/fonts.dart';
import '../helpers/golden_harness.dart' show FileAssetBundle;

final String? _out = Platform.environment['MM_CLOCK_FRAMES'];
const _boundary = ValueKey('capture');
final _bundle = FileAssetBundle();

Future<void> _pump(WidgetTester tester, Widget child, {required Brightness brightness, double width = 360, bool reduce = false}) async {
  tester.view.physicalSize = Size(width, 400) * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
      child: DefaultAssetBundle(
        bundle: _bundle,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(brightness),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduce), child: app!),
          home: Scaffold(
            body: Center(
              child: RepaintBoundary(
                key: _boundary,
                child: Padding(padding: const EdgeInsets.all(MmSpace.gutter), child: child),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

/// Decodes the stopwatch's render before anything shows it (a load begun inside the fake clock
/// never completes), through the same bundle so the cache key matches.
Future<void> _precache(WidgetTester tester, Brightness b) async {
  await _pump(tester, const SizedBox(width: 10, height: 10), brightness: b);
  await tester.runAsync(() async {
    final ctx = tester.element(find.byKey(_boundary));
    await precacheImage(AssetImage(HybridStopwatch.spec.asset, bundle: _bundle), ctx);
  });
}

/// Captures the boundary at each of [atMs] (ms since now, ascending) and writes a labelled sheet.
Future<void> _sheet(WidgetTester tester, String name, List<int> atMs, {Rect? crop, int columns = 6, double scale = 1}) async {
  final object = tester.renderObject(find.byKey(_boundary)) as RenderRepaintBoundary;
  final frames = <ui.Image>[];
  var previous = 0;
  for (final at in atMs) {
    if (at > previous) await tester.pump(Duration(milliseconds: at - previous));
    previous = at;
    final image = await tester.runAsync(() => object.toImage(pixelRatio: 3));
    frames.add(image!);
  }
  final full = Rect.fromLTWH(0, 0, frames.first.width.toDouble(), frames.first.height.toDouble());
  final source = crop == null ? full : Rect.fromLTRB(crop.left * 3, crop.top * 3, crop.right * 3, crop.bottom * 3).intersect(full);
  final tileW = source.width * scale;
  final tileH = source.height * scale;
  const label = 26.0;
  const gap = 4.0;
  final rows = (frames.length / columns).ceil();
  final w = columns * tileW + (columns - 1) * gap;
  final h = rows * (tileH + label) + (rows - 1) * gap;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(Rect.fromLTWH(0, 0, w, h), Paint()..color = const Color(0xFF7F7F7F));
  for (var i = 0; i < frames.length; i++) {
    final dx = (i % columns) * (tileW + gap);
    final dy = (i ~/ columns) * (tileH + label + gap);
    canvas.drawImageRect(frames[i], source, Rect.fromLTWH(dx, dy + label, tileW, tileH), Paint()..filterQuality = FilterQuality.medium);
    final tp = TextPainter(
      text: TextSpan(text: '${atMs[i]} ms', style: const TextStyle(fontFamily: 'HankenGrotesk', fontSize: 18, color: Color(0xFFFFFFFF))),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(dx + 4, dy + 3));
    tp.dispose();
  }
  final picture = recorder.endRecording();
  final sheet = picture.toImageSync(w.ceil(), h.ceil());
  picture.dispose();
  final bytes = await tester.runAsync(() => sheet.toByteData(format: ui.ImageByteFormat.png));
  Directory(_out!).createSync(recursive: true);
  File('${_out!}/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
  sheet.dispose();
  for (final f in frames) {
    f.dispose();
  }
}

Widget _ticket(TicketTear tear) => ComposerTicket(
  subjectId: 'accountancy',
  eyebrow: 'Full mock',
  subject: 'Accountancy',
  count: 50,
  semanticsLabel: 'Full mock, Accountancy',
  tear: tear,
  clock: true,
);

void main() {
  setUpAll(loadAppFonts);
  final skip = _out == null ? 'set MM_CLOCK_FRAMES to write the frame sheets' : null;

  for (final b in Brightness.values) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('the Full mock ticket on the Start sheet, rest to torn, $tag', (tester) async {
      await _precache(tester, b);
      await _pump(tester, _ticket(TicketTear.rest), brightness: b);
      await tester.pump(const Duration(milliseconds: 400));
      await _pump(tester, _ticket(TicketTear.lifted), brightness: b);
      await tester.pump(const Duration(milliseconds: 200));
      await _pump(tester, _ticket(TicketTear.torn), brightness: b);
      final box = tester.getRect(find.byType(ComposerTicket));
      final origin = tester.getTopLeft(find.byKey(_boundary));
      final crop = Rect.fromLTRB(box.right - ComposerTicket.stubWidth - 30, box.top - 12, box.right + 12, box.bottom + 12).shift(-origin);
      await _sheet(tester, 'ticket-lap-$tag', [for (var t = 0; t <= 1200; t += 40) t], crop: crop, columns: 8);
      // The whole ticket at the tear's midpoint and once landed.
      await _pump(tester, _ticket(TicketTear.rest), brightness: b);
      await tester.pumpAndSettle();
      await _pump(tester, _ticket(TicketTear.lifted), brightness: b);
      await tester.pump(const Duration(milliseconds: 200));
      await _pump(tester, _ticket(TicketTear.torn), brightness: b);
      await _sheet(tester, 'ticket-whole-$tag', [0, 110, 400, 1000], columns: 2);
    }, skip: skip != null);

    testWidgets('the stopwatch alone, large, lapping, $tag', (tester) async {
      await _precache(tester, b);
      await _pump(tester, const HybridStopwatch(height: 240, mode: StopwatchMode.done), brightness: b);
      await tester.pump(const Duration(seconds: 2));
      await _pump(tester, const HybridStopwatch(height: 240, mode: StopwatchMode.lap), brightness: b);
      await _sheet(tester, 'large-lap-$tag', [for (var t = 0; t <= 1150; t += 50) t], columns: 6, scale: 0.5);
    }, skip: skip != null);
  }

  testWidgets('reduced motion: the ticket at the yes', (tester) async {
    await _precache(tester, Brightness.dark);
    await _pump(tester, _ticket(TicketTear.rest), brightness: Brightness.dark, reduce: true);
    await _pump(tester, _ticket(TicketTear.torn), brightness: Brightness.dark, reduce: true);
    await _sheet(tester, 'ticket-reduced-night', [0, 300], columns: 2);
  }, skip: skip != null);
}
