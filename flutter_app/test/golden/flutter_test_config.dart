// Every golden under test/golden runs on one fixed afternoon. Mobi reads the clock (sleepy or
// asleep from 23:00 to 05:00, and the hub, help, practice, review and rhythm Mobis follow it), so
// without this a run late at night drew a sleeping Mobi and every Mobi golden flipped with the
// hour of the run. The clock still runs (from 14:00 on 15 October 2026, at real speed), so the
// rations' gaps expire between tests as they did on the wall clock. A test that needs another
// time still sets MobiRation.now itself.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mobi_ration.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  final origin = DateTime(2026, 10, 15, 14);
  final started = DateTime.now();
  DateTime pinned() => origin.add(DateTime.now().difference(started));
  setUp(() => MobiRation.now = pinned);
  tearDown(() => MobiRation.now = DateTime.now);
  await testMain();
}
