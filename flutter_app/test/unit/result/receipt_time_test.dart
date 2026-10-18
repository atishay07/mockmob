// H1 of the v15 emulator walk: a full mock saved at 7:04 AM IST printed "Recorded 1:34 AM". The recap model hands the
// screens times already in the student's own zone (a TZDateTime in the saved zone); the full result then called
// `.toLocal()` on them, and a zone-aware time's `toLocal()` lands in the timezone package's default zone, UTC. These
// tests hold the one conversion: a UTC ISO string in, the student's IST clock out, on every receipt.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/copy/formatters.dart' show formatTime12;
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/notifications/timezones.dart' show locationFor;
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/next_move.dart' show receiptLine;
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../helpers/fonts.dart';
import 'support/fixtures.dart';
import 'support/harness.dart';

void main() {
  setUpAll(loadAppFonts);

  // 7:04 AM in Kolkata, as the server sends it: an ISO string with its zone, UTC.
  const savedIso = '2026-10-18T01:34:00.000Z';
  final ist = locationFor('Asia/Kolkata');
  DateTime studentClock(DateTime t) => tz.TZDateTime.from(t, ist);

  AttemptDetail savedAt7am() => detail(attemptBody: attemptJson(completedAt: DateTime.parse(savedIso)));

  RecapModel model({DateTime? receivedAt}) {
    final d = savedAt7am();
    return buildRecapModel(attempt: d.attempt, detail: d, attempts: [...history(), d.attempt], receivedAt: receivedAt, toLocal: studentClock);
  }

  group('the receipt time of a full mock', () {
    test('a paper with no acknowledgement on the phone reads its submit time in the student\'s zone', () {
      final m = model();
      expect(m.receivedAt, isNull);
      expect(formatTime12(m.recordedAt), '7:04 AM');
      final line = receiptLine(
        subjectName: 'Accountancy',
        mode: 'full',
        at: m.recordedAt,
        now: studentClock(DateTime.parse('2026-10-18T02:00:00Z')),
      );
      expect(line, 'Accountancy full mock. Recorded 7:04 AM.');
    });

    test('an acknowledgement time wins and reads in the same zone', () {
      final m = model(receivedAt: DateTime.parse('2026-10-18T01:34:20.000Z'));
      expect(formatTime12(m.recordedAt), '7:04 AM');
      expect(m.recordedAt, m.receivedAt);
    });

    test('the receipt, the reveal and the recap all say the same time for one paper', () {
      final m = model(receivedAt: DateTime.parse('2026-10-18T01:34:20.000Z'));
      expect(formatTime12(m.submittedAt), formatTime12(m.recordedAt));
    });

    test('a second toLocal() is what moved the time 5 hours 30 minutes early', () {
      tz.setLocalLocation(tz.UTC);
      addTearDown(() => tz.setLocalLocation(tz.UTC));
      final m = model();
      expect(formatTime12(m.submittedAt.toLocal()), '1:34 AM', reason: 'the bug the walk saw: UTC shown as local');
      expect(formatTime12(m.recordedAt), '7:04 AM', reason: 'the screens now read recordedAt and never convert it again');
    });

    test('a student in another zone reads that zone\'s clock, not the phone\'s', () {
      final dubai = locationFor('Asia/Dubai');
      final d = savedAt7am();
      final m = buildRecapModel(attempt: d.attempt, detail: d, attempts: [...history(), d.attempt], toLocal: (t) => tz.TZDateTime.from(t, dubai));
      expect(formatTime12(m.recordedAt), '5:34 AM');
    });
  });

  testWidgets('the full result head prints the student\'s clock for a UTC ISO paper (IST: 7:04 AM)', (tester) async {
    final d = savedAt7am();
    final data = RecapData(model: model(), attempt: d.attempt, detail: d);
    await pumpResultRoute(
      tester,
      openFolds: true,
      location: '/result/a7',
      overrides: resultOverrides(attemptId: 'a7', data: data, log: ResultLog(), now: DateTime.parse('2026-10-18T02:00:00Z')),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.textContaining('Recorded 7:04 AM'), findsOneWidget);
    expect(find.textContaining('1:34 AM'), findsNothing);
  });
}
