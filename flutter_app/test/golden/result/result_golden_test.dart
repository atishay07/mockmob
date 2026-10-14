import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/today/logic/today_model.dart' show GoTo, TodayAction;

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart';
import '../../unit/result/support/harness.dart';

/// The first Business Studies mock after six Accountancy ones: a long title, and (with [blanksOnly])
/// a leading chapter that lost marks to blanks alone.
({RecapModel model, AttemptDetail detail}) _firstBusinessStudies({bool blanksOnly = false}) {
  final paper = blanksOnly
      ? [
          for (var i = 0; i < 6; i++) ('Business environment', V.blank),
          for (var i = 0; i < 10; i++) ('Nature and purpose of business', V.right),
        ]
      : null;
  final d = detail(attemptBody: attemptJson(subject: 'business_studies', paper: paper));
  return (model: mock7(withDetail: d, attempts: [...history(), d.attempt]), detail: d);
}

RecapData _data(RecapModel m, {AttemptDetail? d}) {
  final det = d ?? detail();
  return RecapData(model: m, attempt: det.attempt, detail: det, fetchedAt: DateTime(2026, 10, 12, 22, 44));
}

Future<void> _shot(WidgetTester tester, String name) async {
  await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/$name.png'));
  final dir = Platform.environment['MM_PREVIEW_DIR'];
  if (dir == null || dir.isEmpty) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(resultGoldenKey));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    await File('$dir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

/// Pumps [location] and lets images decode and one-shot motion finish.
Future<void> _open(
  WidgetTester tester,
  String location,
  RecapModel m, {
  Brightness b = Brightness.dark,
  RecapRitual ritual = const RecapRitual(sheetsOpened: 1),
  AttemptDetail? d,
  int? progress,
  bool reminderDue = false,
  Duration settle = const Duration(milliseconds: 1800),
  Size size = const Size(384, 853),
  double textScale = 1,
  TodayAction? nextMove,
}) async {
  await pumpResultRoute(
    tester,
    location: location,
    brightness: b,
    size: size,
    textScale: textScale,
    overrides: resultOverrides(
      attemptId: m.attemptId,
      data: _data(m, d: d),
      ritual: ritual,
      progress: progress,
      reminderDue: reminderDue,
      nextMove: nextMove,
    ),
  );
  await settleImages(tester);
  await tester.pump(settle);
  await settleImages(tester);
}

/// One frame to start tickers, then [ms] of real frames.
Future<void> _frames(WidgetTester tester, int ms) async {
  await tester.pump();
  for (var t = 0; t < ms; t += 16) {
    await tester.pump(const Duration(milliseconds: 16));
  }
}

/// Drags the tab up by [dy] without letting go, for the unfold key frames.
Future<TestGesture> _hold(WidgetTester tester, double dy) async {
  final g = await tester.startGesture(tester.getCenter(find.text('Open your result')));
  await g.moveBy(const Offset(0, -20));
  await tester.pump();
  await g.moveBy(Offset(0, -(dy - 20)));
  await tester.pump();
  return g;
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in [Brightness.dark, Brightness.light]) {
    final tag = b == Brightness.dark ? 'night' : 'day';

    testWidgets('sealed, folded ($tag)', (tester) async {
      await _open(tester, '/result/a7/sealed', mock7(), b: b, settle: const Duration(milliseconds: 900));
      await _shot(tester, 'sealed_folded_$tag');
    });

    testWidgets('sealed, unfolding at 50% ($tag)', (tester) async {
      await _open(tester, '/result/a7/sealed', mock7(), b: b, settle: const Duration(milliseconds: 900));
      final g = await _hold(tester, 90);
      await settleImages(tester);
      await _shot(tester, 'sealed_unfold50_$tag');
      await g.up();
      await tester.pump(const Duration(seconds: 3));
    });

    if (b == Brightness.dark) {
      testWidgets('sealed, unfolding at 25% and 80% (night)', (tester) async {
        await _open(tester, '/result/a7/sealed', mock7(), settle: const Duration(milliseconds: 900));
        final g = await _hold(tester, 45);
        await settleImages(tester);
        await _shot(tester, 'sealed_unfold25_night');
        await g.moveBy(const Offset(0, -99));
        await tester.pump();
        await settleImages(tester);
        await _shot(tester, 'sealed_unfold80_night');
        await g.up();
        await tester.pump(const Duration(seconds: 3));
      });
    }

    testWidgets('card 1, open ($tag)', (tester) async {
      await _open(tester, '/result/a7/recap/1', mock7(), b: b);
      await _shot(tester, 'card1_open_$tag');
    });

    testWidgets('card 2 ($tag)', (tester) async {
      await _open(tester, '/result/a7/recap/2', mock7(), b: b);
      await _shot(tester, 'card2_$tag');
    });

    testWidgets('card 3 ($tag)', (tester) async {
      await _open(tester, '/result/a7/recap/3', mock7(), b: b);
      await _shot(tester, 'card3_$tag');
    });

    testWidgets('card 3, blanks only ($tag)', (tester) async {
      final f = _firstBusinessStudies(blanksOnly: true);
      await _open(tester, '/result/a7/recap/3', f.model, b: b, d: f.detail);
      await _shot(tester, 'card3_blanks_$tag');
    });

    testWidgets('card 4 ($tag)', (tester) async {
      await _open(tester, '/result/a7/recap/4', mock7(), b: b);
      await _shot(tester, 'card4_$tag');
    });

    testWidgets('card 4, nothing to repair, next move named ($tag)', (tester) async {
      final f = _firstBusinessStudies(blanksOnly: true);
      await _open(
        tester,
        '/result/a7/recap/4',
        f.model,
        b: b,
        d: f.detail,
        nextMove: const TodayAction(
          'Start mixed practice, 10 questions',
          GoTo('/practice/setup/quick?count=10&subject=business_studies'),
          startsSession: true,
          actionType: 'practice',
        ),
      );
      await _shot(tester, 'card4_no_repair_next_$tag');
    });

    testWidgets('card 4, nothing to repair, no next move ($tag)', (tester) async {
      final f = _firstBusinessStudies(blanksOnly: true);
      await _open(tester, '/result/a7/recap/4', f.model, b: b, d: f.detail);
      await _shot(tester, 'card4_no_repair_finish_$tag');
    });

    testWidgets('full result ($tag)', (tester) async {
      await _open(tester, '/result/a7', mock7(), b: b, progress: 3);
      await _shot(tester, 'full_top_$tag');
    });
  }

  // Variants, Night only plus the day for the held state.
  testWidgets('card 1, held (night)', (tester) async {
    final d = detail(
      reviews: {
        'q3': {'state': 'under_review'},
        'q17': {'state': 'withdrawn'},
      },
    );
    await _open(tester, '/result/a7/recap/1', mock7(withDetail: d), d: d);
    await _shot(tester, 'card1_held_night');
  });

  testWidgets('card 1, lower (night)', (tester) async {
    final d = detail(
      recap: {
        'tone': 'lower',
        'previousComparable': {'marks': 142, 'max': 250, 'attemptId': 'p5'},
      },
    );
    await _open(tester, '/result/a7/recap/1', mock7(withDetail: d), d: d);
    await _shot(tester, 'card1_lower_night');
  });

  testWidgets('card 1, first mock (night)', (tester) async {
    final d = detail();
    await _open(
      tester,
      '/result/a7/recap/1',
      mock7(withDetail: d, attempts: [d.attempt]),
      d: d,
    );
    await _shot(tester, 'card1_first_night');
  });

  testWidgets('card 4, first mock with token and reminder (night)', (tester) async {
    final d = detail();
    final m = mock7(
      withDetail: d,
      attempts: [d.attempt],
      milestones: [RhythmMilestone(id: 'first_full_mock', achievedAt: DateTime.utc(2026, 10, 12, 17, 14))],
    );
    await _open(tester, '/result/a7/sealed', m, ritual: const RecapRitual(), reminderDue: true, settle: const Duration(milliseconds: 300));
    // Open by tap, then go to card 4 through the keys.
    await tester.tap(find.text('Open your result'));
    await _frames(tester, 2400);
    await tester.tap(find.text('Where the marks went'));
    await _frames(tester, 700);
    await tester.tap(find.text('The first thing to fix'));
    await _frames(tester, 700);
    await tester.tap(find.text('Choose how to fix it'));
    await _frames(tester, 700);
    await settleImages(tester);
    await _shot(tester, 'card4_first_night');
  });

  testWidgets('card 4, share your sheet preview (night)', (tester) async {
    await _open(tester, '/result/a7/recap/4', mock7());
    await tester.ensureVisible(find.text('Share your sheet'));
    await tester.pump();
    await tester.tap(find.text('Share your sheet'));
    await _frames(tester, 700);
    await settleImages(tester);
    await _shot(tester, 'card4_share_night');
  });

  testWidgets('full result, answers (night)', (tester) async {
    await _open(tester, '/result/a7?q=9', mock7());
    await _shot(tester, 'full_answers_night');
  });

  testWidgets('full result, loading (night)', (tester) async {
    await pumpResultRoute(
      tester,
      location: '/result/a7',
      overrides: resultOverrides(attemptId: 'a7', data: const RecapData(loading: true)),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await _shot(tester, 'full_loading_night');
  });

  // The smallest supported frame (360 by 780) and large text, so nothing clips.
  const compact = Size(360, 780);
  testWidgets('compact: sealed (night)', (tester) async {
    await _open(tester, '/result/a7/sealed', mock7(), size: compact, settle: const Duration(milliseconds: 900));
    await _shot(tester, 'compact_sealed_night');
  });
  testWidgets('compact: card 1 (night)', (tester) async {
    await _open(tester, '/result/a7/recap/1', mock7(), size: compact);
    await _shot(tester, 'compact_card1_night');
  });
  testWidgets('compact: card 4 (day)', (tester) async {
    await _open(tester, '/result/a7/recap/4', mock7(), size: compact, b: Brightness.light);
    await _shot(tester, 'compact_card4_day');
  });
  testWidgets('large text: card 1 (night)', (tester) async {
    await _open(tester, '/result/a7/recap/1', mock7(), textScale: 1.5);
    await _shot(tester, 'large_card1_night');
  });
  testWidgets('large text 1.3x: card 4 (night)', (tester) async {
    await _open(tester, '/result/a7/recap/4', mock7(), size: compact, textScale: 1.3);
    await _shot(tester, 'large13_card4_night');
  });
  testWidgets('large text 1.3x: full result, long title (day)', (tester) async {
    final f = _firstBusinessStudies();
    await _open(tester, '/result/a7', f.model, b: Brightness.light, d: f.detail, size: compact, textScale: 1.3);
    await _shot(tester, 'large13_full_top_day');
  });
  testWidgets('full result, blanks folded (night)', (tester) async {
    final f = _firstBusinessStudies(blanksOnly: true);
    await _open(tester, '/result/a7', f.model, d: f.detail);
    await tester.scrollUntilVisible(find.text('Not attempted (6)'), 300, scrollable: find.byType(Scrollable).first);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, 200));
    await tester.pump(const Duration(milliseconds: 600));
    await _shot(tester, 'full_blanks_folded_night');
    await tester.tap(find.text('Not attempted (6)'));
    await _frames(tester, 500);
    await _shot(tester, 'full_blanks_open_night');
  });
  testWidgets('large text: card 4 (night)', (tester) async {
    await _open(tester, '/result/a7/recap/4', mock7(), textScale: 1.5);
    await _shot(tester, 'large_card4_night');
  });

  testWidgets('card 1, higher, after the hop (night)', (tester) async {
    final d = detail(recap: {
      'tone': 'higher',
      'previousComparable': {'marks': 92, 'max': 250, 'attemptId': 'p5'},
    });
    await _open(tester, '/result/a7/recap/1', mock7(withDetail: d), d: d);
    await _shot(tester, 'card1_higher_night');
  });

  testWidgets('card 1, mid-reveal: the reader passing, rows inking as it reads (night)', (tester) async {
    await pumpResultRoute(
      tester,
      location: '/result/a7/recap/1',
      overrides: resultOverrides(attemptId: 'a7', data: _data(mock7())),
    );
    await _frames(tester, 620);
    await _shot(tester, 'card1_reveal_mid_night');
    await _frames(tester, 2000);
  });
}
