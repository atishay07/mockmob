// The demo's open paper is a real SessionDraft, so the bar's Resume capsule, Today's resume hero
// and Start's Resume row can all be seen in the demo build (device walk-through, finding 17).
import 'dart:async';

import 'package:clock/clock.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/session_rules.dart';

import '../../device_demo/demo_questions.dart';
import '../../device_demo/demo_session.dart';

DemoSession _paper(String id, {Duration length = const Duration(minutes: 10)}) => DemoSession(
  id,
  questions: demoQuestions('accountancy', 10, id),
  mode: 'quick',
  subject: 'accountancy',
  remaining: length,
  endsAt: clock.now().add(length),
);

void main() {
  test('a paper that starts is the open draft, and it can be resumed', () {
    fakeAsync((async) {
      final session = _paper('d1');
      final draft = demoDrafts.latest!;
      expect(draft.sessionId, 'd1');
      expect(draft.view.questions, hasLength(10));
      expect(draft.subject, 'accountancy');
      expect(resumableDraft(draft, sessionId: 'd1', nowMs: clock.now().millisecondsSinceEpoch), isTrue);
      unawaited(session.close());
      async.flushMicrotasks();
    });
  });

  test('leaving an open paper writes its draft again with the position it reached', () {
    fakeAsync((async) {
      final session = _paper('d2');
      final seen = <int>[];
      final sub = demoDrafts.watch().listen((d) => seen.add(d?.currentIndex ?? -1));
      async.flushMicrotasks();
      unawaited(session.selectAnswer(session.questions[0].id, 1));
      unawaited(session.goTo(3));
      async.flushMicrotasks();
      unawaited(session.close());
      async.flushMicrotasks();
      expect(demoDrafts.latest!.currentIndex, 3);
      expect(seen.last, 3, reason: 'listeners hear the new draft');
      expect(session.answers, hasLength(1));
      unawaited(sub.cancel());
      async.flushMicrotasks();
    });
  });

  test('a submit clears the draft, and a newer paper is never cleared by an older one', () {
    fakeAsync((async) {
      final older = _paper('d3');
      final newer = _paper('d4');
      expect(demoDrafts.latest!.sessionId, 'd4');
      demoDrafts.clear('d3');
      expect(demoDrafts.latest?.sessionId, 'd4', reason: 'only its own paper clears it');
      unawaited(newer.submit());
      async.flushMicrotasks();
      expect(demoDrafts.latest, isNull);
      unawaited(older.close());
      async.flushMicrotasks();
      expect(demoDrafts.latest, isNull, reason: 'closing a paper that is no longer the open one writes nothing');
      async.elapse(const Duration(seconds: 2));
    });
  });

  test('the clock runs on after a paper is left and opened again', () {
    fakeAsync((async) {
      final session = _paper('d5');
      unawaited(session.close());
      async.flushMicrotasks();
      async.elapse(const Duration(minutes: 2));
      session.resumeClock();
      async.elapse(const Duration(seconds: 1));
      expect(session.remaining.value, const Duration(minutes: 7, seconds: 59));
      unawaited(session.close());
      async.flushMicrotasks();
    });
  });
}
