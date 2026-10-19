import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/widgets/bubbles/bubble_painter.dart';
import 'package:mockmob/features/rhythm/rhythm.dart' show CelebrationMode;
import 'package:mockmob/features/result/copy.dart';
import 'package:mockmob/features/result/model/answer_items.dart';
import 'package:mockmob/features/result/model/recap_variant.dart';
import 'package:mockmob/features/result/recap/card_drag.dart';
import 'package:mockmob/features/result/recap/first_fix_card.dart' show RulerTimeline;
import 'package:mockmob/features/result/recap/recap_mobi.dart';
import 'package:mockmob/features/result/widgets/answer_map.dart';
import 'package:mockmob/features/result/widgets/answer_reactor.dart';
import 'package:mockmob/features/result/widgets/breakdown_section.dart' show PickedKind;
import 'package:mockmob/features/result/widgets/marks_bar.dart' show MarkPart;
import 'package:mockmob/features/result/widgets/marks_flow.dart';

/// A Mobi that records what it is asked to do.
class _Host implements MobiHost {
  final List<MobiAct> plays = [];

  @override
  void play(MobiAct act, {double? seconds}) => plays.add(act);

  @override
  void lookAtGlobal(Offset? point) {}

  @override
  void pointAtGlobal(Offset point) {}
}

void main() {
  group('the reaction table', () {
    RecapReaction? at(RecapVariant v, {CelebrationMode mode = CelebrationMode.full, bool nta = false, int hour = 14}) =>
        recapReaction(variant: v, mode: mode, isNta: nta, hour: hour);

    test('the first mock stands proud, a higher result cheers, a lower or held result is encouraged, a standard one rests', () {
      expect(at(RecapVariant.firstMock)?.act, MobiAct.proud);
      expect(at(RecapVariant.higher)?.act, MobiAct.cheer);
      expect(at(RecapVariant.lower)?.act, MobiAct.encourage);
      expect(at(RecapVariant.held)?.act, MobiAct.encourage);
      expect(at(RecapVariant.standard)?.act, MobiAct.rest);
      expect(at(RecapVariant.standard)?.line, isNull);
    });

    test('NTA mode gets nothing, for every variant and every hour', () {
      for (final v in RecapVariant.values) {
        for (final h in [0, 3, 12, 23]) {
          expect(at(v, nta: true, hour: h), isNull, reason: '$v at $h');
        }
      }
    });

    test('Quiet and Off turn proud and cheer into a rest; encouragement stays', () {
      for (final mode in [CelebrationMode.quiet, CelebrationMode.off]) {
        expect(at(RecapVariant.firstMock, mode: mode)?.act, MobiAct.rest);
        expect(at(RecapVariant.higher, mode: mode)?.act, MobiAct.rest);
        expect(at(RecapVariant.lower, mode: mode)?.act, MobiAct.encourage);
      }
    });

    test('the hour never changes the reaction: the sleepy late-night Mobi is retired (owner, 17 Oct, F11)', () {
      for (final v in RecapVariant.values) {
        for (final h in [23, 0, 1, 4]) {
          expect(at(v, hour: h), at(v, hour: 15), reason: '$v at $h reads like the afternoon');
          expect(at(v, hour: h)?.act, isNot(MobiAct.sleepy), reason: '$v at $h');
          expect(at(v, hour: h)?.line, isNull, reason: 'no Goodnight at $h');
        }
      }
      expect(ResultCopy.goodnight, 'Goodnight');
    });

    test('a lower or held result is never met with a celebration, at any hour or setting', () {
      for (final v in [RecapVariant.lower, RecapVariant.held]) {
        for (final mode in CelebrationMode.values) {
          for (var h = 0; h < 24; h++) {
            final act = at(v, mode: mode, hour: h)!.act;
            expect(act, isNot(anyOf(MobiAct.cheer, MobiAct.celebrate, MobiAct.proud)));
          }
        }
      }
    });

    test('every reaction maps to a Mobi pose that plays the same act', () {
      for (final v in RecapVariant.values) {
        final r = at(v)!;
        expect(RecapMobi.poseFor(r.act).act, r.act, reason: '$v');
      }
      expect(RecapMobi.poseOf(null), isNull);
    });
  });

  group('how long the finish screen holds', () {
    test('the act plus 900 ms, never under 2 seconds', () {
      expect(recapFinishHold(const RecapReaction(MobiAct.proud), reduced: false), const Duration(milliseconds: 3100));
      expect(recapFinishHold(const RecapReaction(MobiAct.cheer), reduced: false), const Duration(milliseconds: 2100));
      expect(recapFinishHold(const RecapReaction(MobiAct.encourage), reduced: false), const Duration(milliseconds: 2350));
      expect(recapFinishHold(const RecapReaction(MobiAct.rest), reduced: false), const Duration(milliseconds: 2000));
      expect(recapFinishHold(const RecapReaction(MobiAct.sleepy), reduced: false), const Duration(milliseconds: 3100));
    });

    test('no Mobi (NTA) or a held pose (reduced motion) waits the plain 2.2 seconds', () {
      expect(recapFinishHold(null, reduced: false), const Duration(milliseconds: 2200));
      expect(recapFinishHold(const RecapReaction(MobiAct.proud), reduced: true), const Duration(milliseconds: 2200));
    });
  });

  group('the answer reactor', () {
    var clock = DateTime(2026, 10, 15, 12);
    late MobiController controller;
    late _Host host;
    late AnswerReactor reactor;

    setUp(() {
      clock = DateTime(2026, 10, 15, 12);
      controller = MobiController();
      host = _Host();
      controller.attach(host);
      reactor = AnswerReactor(controller, now: () => clock);
    });

    tearDown(() {
      reactor.dispose();
      controller.dispose();
    });

    test('a wrong or blank answer is met with encouragement; a right one with the hop', () {
      expect(reactor.react(Verdict.wrong), isTrue);
      expect(host.plays, [MobiAct.encourage]);
      clock = clock.add(const Duration(seconds: 3));
      expect(reactor.react(Verdict.blank), isTrue);
      clock = clock.add(const Duration(seconds: 3));
      expect(reactor.react(Verdict.correct), isTrue);
      expect(host.plays, [MobiAct.encourage, MobiAct.encourage, MobiAct.correct]);
    });

    test('one act per 2.5 seconds', () {
      expect(reactor.react(Verdict.wrong), isTrue);
      clock = clock.add(const Duration(milliseconds: 2400));
      expect(reactor.react(Verdict.correct), isFalse);
      clock = clock.add(const Duration(milliseconds: 100));
      expect(reactor.react(Verdict.correct), isTrue);
      expect(host.plays, [MobiAct.encourage, MobiAct.correct]);
    });

    test('a held answer, or a Mobi that is not allowed to act, plays nothing and uses up no turn', () {
      expect(reactor.react(Verdict.held), isFalse);
      expect(reactor.react(Verdict.wrong, allowed: false), isFalse);
      expect(host.plays, isEmpty);
      expect(reactor.react(Verdict.wrong), isTrue, reason: 'the refused ones did not start the clock');
    });

    testWidgets('after the hop Mobi goes back to reading the sheet', (tester) async {
      var now = DateTime(2026, 10, 15, 12);
      final c = MobiController();
      final h = _Host();
      c.attach(h);
      final r = AnswerReactor(c, now: () => now);
      expect(r.react(Verdict.correct), isTrue);
      await tester.pump(const Duration(milliseconds: 1300));
      expect(h.plays, [MobiAct.correct, MobiAct.read]);
      r.dispose();
      c.dispose();
      now = now.add(const Duration(seconds: 1));
    });
  });

  group('the answer map', () {
    test('the two coral pulses land on the first wrong answer, and nothing pulses without one', () {
      final cells = [BubbleState.filled, BubbleState.blank, BubbleState.wrong, BubbleState.wrong, BubbleState.filled];
      expect(AnswerMap.firstWrong(cells), 2);
      expect(AnswerMap.firstWrong([BubbleState.filled, BubbleState.blank]), isNull);
    });

    test('a long press says the question, the subject and the verdict', () {
      expect(AnswerMap.tip(12, 'Accountancy', BubbleState.wrong), 'Q12, Accountancy: wrong');
      expect(AnswerMap.tip(3, 'Accountancy', BubbleState.filled), 'Q3, Accountancy: correct');
      expect(AnswerMap.tip(4, 'Accountancy', BubbleState.blank), 'Q4, Accountancy: not attempted');
      expect(AnswerMap.tip(5, 'Accountancy', BubbleState.marked), 'Q5, Accountancy: being checked');
    });

    test('the arrival finishes with the second pulse inside its length', () {
      const end = AnswerMap.pulseStart + AnswerMap.pulseGap + AnswerMap.pulseLife;
      expect(end, lessThanOrEqualTo(AnswerMap.total.inMilliseconds));
      expect(AnswerMap.rippleSpan + AnswerMap.ringLife, lessThanOrEqualTo(AnswerMap.pulseStart + 40));
    });
  });

  group('the marks flow picks', () {
    test('the picked ribbon stays at full strength and the others fall to 35%', () {
      expect(MarksFlow.strengthOf(1, null, 1), 1);
      expect(MarksFlow.strengthOf(1, 1, 1), 1);
      expect(MarksFlow.strengthOf(0, 1, 1), closeTo(0.35, 1e-9));
      expect(MarksFlow.strengthOf(0, 1, 0), 1);
      expect(MarksFlow.strengthOf(0, 1, 0.5), closeTo(0.675, 1e-9));
    });

    test('each kind opens the answers it is about, in paper order', () {
      final cells = [
        BubbleState.filled,
        BubbleState.wrong,
        BubbleState.blank,
        BubbleState.filled,
        BubbleState.wrong,
      ];
      expect(PickedKind.numbersFor(MarkPart.scored, cells), [1, 4]);
      expect(PickedKind.numbersFor(MarkPart.takenOff, cells), [2, 5]);
      expect(PickedKind.numbersFor(MarkPart.notEarnedWrong, cells), [2, 5]);
      expect(PickedKind.numbersFor(MarkPart.notEarnedBlank, cells), [3]);
    });

    test('one sentence of count and marks for each kind', () {
      final b = markBreakdown(26, 15, 9);
      expect(ResultCopy.flowSentence(MarkPart.scored, b), '26 correct answers, 115 marks scored.');
      expect(ResultCopy.flowSentence(MarkPart.takenOff, b), '15 wrong answers, 15 marks taken off.');
      expect(ResultCopy.flowSentence(MarkPart.notEarnedWrong, b), '15 wrong answers, 75 marks not earned.');
      expect(ResultCopy.flowSentence(MarkPart.notEarnedBlank, b), '9 not attempted, 45 marks not earned.');
    });
  });

  group('the ruler on card 3', () {
    test('the stems rise in paper order and the chips follow their stems', () {
      const n = 6;
      for (var i = 1; i < n; i++) {
        expect(RulerTimeline.stemStart(i, n), greaterThan(RulerTimeline.stemStart(i - 1, n)));
        expect(RulerTimeline.chip(RulerTimeline.stemStart(i, n).toDouble(), i, n), 0, reason: 'a chip waits for its stem');
      }
      for (var i = 0; i < n; i++) {
        final end = RulerTimeline.total(n).toDouble();
        expect(RulerTimeline.stem(end, i, n), 1);
        expect(RulerTimeline.chip(end, i, n), 1);
      }
      expect(RulerTimeline.baseline(0), 0);
      expect(RulerTimeline.baseline(RulerTimeline.baselineMs.toDouble()), 1);
    });

    test('Mobi points as the last stem lands', () {
      for (final n in [1, 3, 12, 40]) {
        final land = RulerTimeline.start + RulerTimeline.stemEnd(n - 1, n);
        expect(RulerTimeline.pointAt(n).inMilliseconds, land);
        expect(RulerTimeline.total(n), greaterThanOrEqualTo(RulerTimeline.stemEnd(n - 1, n)));
      }
    });

    test('a long ruler does not drag', () {
      expect(RulerTimeline.total(40), lessThan(2200));
    });
  });

  group('the card drag', () {
    test('the card is in the hand toward a card that exists, and on a rubber band toward none (AP3-01)', () {
      expect(CardDrag.shiftFor(-72, hasNext: true, hasBack: true), -72, reason: 'a 72 dp drag moves the card 72 dp');
      expect(CardDrag.shiftFor(72, hasNext: true, hasBack: true), 72);
      expect(CardDrag.shiftFor(-300, hasNext: true, hasBack: true), -300, reason: 'no cap before the commit');
      expect(CardDrag.shiftFor(-100, hasNext: false, hasBack: true), closeTo(-15, 1e-9));
      expect(CardDrag.shiftFor(100, hasNext: true, hasBack: false), closeTo(15, 1e-9));
      expect(CardDrag.shiftFor(-2000, hasNext: false, hasBack: true), -CardDrag.edgeMax);
    });

    test('past 30% of the card or a 500 px/s flick turns it; short of that it springs back', () {
      expect(CardDrag.commitFor(384), closeTo(115.2, 1e-9));
      expect(CardDrag.decide(-120, 0, hasNext: true, hasBack: true, width: 384), -1);
      expect(CardDrag.decide(120, 0, hasNext: true, hasBack: true, width: 384), 1);
      expect(CardDrag.decide(-100, 0, hasNext: true, hasBack: true, width: 384), 0);
      expect(CardDrag.decide(-40, -520, hasNext: true, hasBack: true), -1, reason: 'a flick');
      expect(CardDrag.decide(-40, -450, hasNext: true, hasBack: true), 0, reason: 'too slow to be a flick');
      expect(CardDrag.decide(-40, 900, hasNext: true, hasBack: true), 0, reason: 'a flick the other way is not a commit');
      expect(CardDrag.decide(-200, 0, hasNext: false, hasBack: true), 0, reason: 'no next card');
      expect(CardDrag.decide(200, 0, hasNext: true, hasBack: false), 0, reason: 'no previous card');
    });

    testWidgets('a 72 dp drag moves the card 72 dp under the finger', (tester) async {
      final c = CardDragController();
      addTearDown(c.dispose);
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CardDrag(controller: c, onNext: () {}, onBack: () {}, child: const SizedBox.expand()),
        ),
      ));
      final g = await tester.startGesture(tester.getCenter(find.byType(CardDrag)));
      await g.moveBy(const Offset(-20, 0));
      await g.moveBy(const Offset(-72, 0));
      await tester.pump();
      // The first 20 dp include the drag slop; the 72 after it are followed 1:1.
      expect(c.shift, lessThanOrEqualTo(-72));
      final before = c.shift;
      await g.moveBy(const Offset(-10, 0));
      await tester.pump();
      expect(c.shift, closeTo(before - 10, 1e-6));
      await g.up();
      await tester.pumpAndSettle();
      expect(c.shift, 0, reason: 'short of the commit, the card springs home');
    });
  });

  group('the words', () {
    test('the story bar names its cards', () {
      expect(ResultCopy.cardNamed(2, 4, ResultCopy.cardNames[2]!), 'Card 2 of 4: Where the marks went');
      expect([for (var c = 1; c <= 4; c++) ResultCopy.cardNames[c]], everyElement(isNotNull));
    });

    test('the repair key says what opens', () {
      const all = RepairKeyScope(chapter: 'Principles of management', firstQuestionId: 'q1', count: 5, othersInPaper: 0);
      expect(ResultCopy.repairKey(all, 10), 'Repair 5 mistakes');
      expect(ResultCopy.repairScopeLine(all, 10), 'Principles of management.\nAbout 10 minutes.');
      const some = RepairKeyScope(chapter: 'Principles of management: planning', firstQuestionId: 'q2', count: 1, othersInPaper: 4);
      expect(ResultCopy.repairKey(some, 5), 'Repair 1 mistake');
      expect(ResultCopy.repairScopeLine(some, 5), 'Principles of management.\nAbout 5 minutes. The other 4 are in Your papers.');
      // A shorter length holds some of the chapter's wrong answers: the line says which, with the denominator.
      expect(
        ResultCopy.repairScopeLine(const RepairKeyScope(chapter: 'Admission of a partner', firstQuestionId: 'q', count: 3, othersInPaper: 12), 10, chapterTotal: 4),
        'Admission of a partner, 3 of its 4 wrong answers.\nAbout 10 minutes. The other 12 are in Your papers.',
      );
      expect(ResultCopy.readyToRepairOf(13, 15), '13 of 15 wrong answers ready to repair.');
      expect(ResultCopy.readyToRepairRest(2), 'The other 2 are repaired already, or their answer keys are being checked.');
      const none = RepairKeyScope(chapter: 'Other questions', firstQuestionId: 'q3', count: 2, othersInPaper: 3);
      expect(ResultCopy.repairKey(none, 10), 'Repair 2 mistakes');
    });
  });
}
