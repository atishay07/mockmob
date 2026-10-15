import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/hub/hub_mobi.dart';
import 'package:mockmob/features/you/hub/sheet_fields.dart';

SheetWeek ready({int? done, int? goal, bool paused = false}) =>
    SheetWeek.ready(days: const [], count: '', description: '', done: done, goal: goal, paused: paused);

void main() {
  final noon = DateTime(2026, 10, 15, 12);
  HubMobiReading? read(SheetWeek week, {DateTime? now, CelebrationMode mode = CelebrationMode.full}) =>
      readWeek(week: week, now: now ?? noon, mode: mode);

  test('a met goal is proud, with the real counts', () {
    final r = read(ready(done: 4, goal: 4))!;
    expect(r.act, MobiAct.proud);
    expect(r.line, 'Goal met. Four of four.');
    expect(r.gate, HubMobiGate.met);
  });

  test('more days than the goal says so plainly', () {
    expect(read(ready(done: 5, goal: 4))!.line, 'Goal met. Five days against four.');
  });

  test('Quiet swaps proud for a nod and Off plays nothing but keeps the words', () {
    expect(read(ready(done: 3, goal: 3), mode: CelebrationMode.quiet)!.act, MobiAct.nod);
    final off = read(ready(done: 3, goal: 3), mode: CelebrationMode.off)!;
    expect(off.act, MobiAct.idle);
    expect(off.line, YouCopy.goalMetLine(3, 3));
  });

  test('one day short nudges toward the Rhythm field, silently', () {
    final r = read(ready(done: 3, goal: 4))!;
    expect(r.act, MobiAct.nudge);
    expect(r.pointAtWeek, isTrue);
    expect(r.line, isNull);
    expect(r.gate, HubMobiGate.nudge);
  });

  test('otherwise a plain hello', () {
    expect(read(ready(done: 1, goal: 4))!.act, MobiAct.hello);
  });

  test('0 to 4 AM is sleepy whatever the week says', () {
    expect(read(ready(done: 4, goal: 4), now: DateTime(2026, 10, 15, 2))!.act, MobiAct.sleepy);
    expect(read(const SheetWeek.loading(), now: DateTime(2026, 10, 15, 0, 30))!.act, MobiAct.sleepy);
    expect(read(ready(done: 4, goal: 4), now: DateTime(2026, 10, 15, 5))!.act, MobiAct.proud);
  });

  test('a paused week rests, silently', () {
    final r = read(ready(done: 0, goal: 4, paused: true))!;
    expect(r.act, MobiAct.rest);
    expect(r.line, isNull);
  });

  test('loading and failed are not decided yet; Rhythm off is idle', () {
    expect(read(const SheetWeek.loading()), isNull);
    expect(read(SheetWeek.failed(() {})), isNull);
    expect(read(const SheetWeek.off())!.act, MobiAct.idle);
  });
}
