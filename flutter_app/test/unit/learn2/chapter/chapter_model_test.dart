// The chapter page's own rules (the ones the website keeps inside ChapterPage.jsx), and its dry run: debounced, newest ask
// wins, the last numbers stay while a new answer is on its way. The words of chapterModel.mjs are held by the parity test.
import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/chapter/chapter_preview.dart';
import 'package:mockmob/features/learn2/data/learn_api.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/data/learn_providers.dart';

import 'chapter_test_support.dart';

LearnPreview _recorded(String name, [void Function(Map<String, dynamic> body)? edit]) {
  final body = LearnFixtures.json(name);
  edit?.call(body);
  return LearnPreview.parse(body);
}

/// A server whose answers the test releases by hand, to see which one the page keeps.
class _HeldApi extends ChapterApi {
  final List<(LearnPreviewKey, Completer<LearnPreview>)> held = [];

  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) {
    final c = Completer<LearnPreview>();
    held.add((LearnPreviewKey(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext), c));
    return c.future;
  }
}

void main() {
  group('the piles the page draws', () {
    test('the server\'s piles in the page\'s order: the lesson first, then cards, questions, mistakes', () {
      final data = _recorded('preview_cpsr_20_pro');
      expect(ChapterModel.pilesFor(data, const []).map((p) => p.id), ['lesson', 'cards', 'questions']);
    });

    test('a pile with nothing in it is not drawn, a pile left out stays drawn', () {
      final data = _recorded('preview_aop_10_out_questions_pro');
      final piles = ChapterModel.pilesFor(data, const ['questions']);
      expect(piles.map((p) => (p.id, p.left, p.count)), [('cards', false, 23), ('questions', true, 0), ('mistakes', false, 2)]);
      final empty = _recorded('preview_aop_10_pro', (b) => (b['piles'] as List)[1]['count'] = 0);
      expect(ChapterModel.pilesFor(empty, const []).map((p) => p.id), ['cards', 'mistakes']);
    });

    test('a pile the student has just left out is drawn left out before the new answer comes', () {
      final data = _recorded('preview_aop_10_pro');
      final piles = ChapterModel.pilesFor(data, const ['questions']);
      expect(piles.firstWhere((p) => p.id == 'questions').left, isTrue);
      expect(piles.where((p) => p.left).length, 1);
      // Its count is still the old answer's: only the next answer re-balances the others.
      expect(piles.firstWhere((p) => p.id == 'questions').count, 2);
    });

    test('Free\'s day is used: questions and mistakes are held until tomorrow, the cards pile is the run', () {
      final data = _recorded('preview_pf_10_free_used');
      final piles = ChapterModel.pilesFor(data, const ['questions', 'mistakes']);
      expect(piles.map((p) => (p.id, p.left, p.held)), [('cards', false, false), ('questions', true, true), ('mistakes', true, true)]);
      expect(ChapterModel.pileView(piles[1]).state, PileState.held);
      expect(ChapterModel.pileView(piles[1]).line, 'Back tomorrow');
      // The student who has left them out on top of the server's hold does not turn a held pile into a left-out one.
      final out = ChapterModel.pilesFor(data, const ['questions']);
      expect(out[1].held, isTrue);
    });

    test('"2 of 3": the mistakes pile when the run takes only some of the open ones', () {
      final data = _recorded('preview_pf_10_pro');
      final mistakes = ChapterModel.pilesFor(data, const []).firstWhere((p) => p.id == 'mistakes');
      expect((mistakes.count, mistakes.of), (2, 3));
      expect(ChapterModel.pileView(mistakes).of, 3);
    });

    test('a tap on a pile: out, back, refused when it is the last in, nothing when it is held', () {
      final data = _recorded('preview_aop_10_pro');
      final piles = ChapterModel.pilesFor(data, const []);
      expect(ChapterModel.tapOn(piles.first, piles), PileTap.leaveOut);
      final oneOut = ChapterModel.pilesFor(data, const ['cards']);
      expect(ChapterModel.tapOn(oneOut.first, oneOut), PileTap.putBack);
      final onlyOne = ChapterModel.pilesFor(data, const ['cards', 'questions']);
      final last = onlyOne.firstWhere((p) => !p.left);
      expect(ChapterModel.tapOn(last, onlyOne), PileTap.refused);
      expect(ChapterModel.tapOn(last.copyWith(held: true), onlyOne), PileTap.none);
    });
  });

  group('the Start key', () {
    test('names the real length the server says, and "Start 10 minutes" before it has said', () {
      expect(ChapterModel.startLabel(_recorded('preview_pf_10_free_used'), 10), 'Start 1 minute');
      expect(ChapterModel.startLabel(null, 10), 'Start 10 minutes');
      expect(ChapterModel.startLabel(null, 35), 'Start 35 minutes');
    });

    test('beside a run to pick up it is "Start a new 10 minutes"', () {
      expect(ChapterModel.startLabel(_recorded('preview_aop_10_pro'), 10, resume: true), 'Start a new 10 minutes');
      expect(ChapterModel.startLabel(null, 20, resume: true), 'Start a new 20 minutes');
    });

    test('a run to pick up is one with something left to do', () {
      expect(ChapterModel.openRun(_recorded('preview_aop_10_pro'))?.runId, 'lr_aa19581b98132d65737b96f0');
      expect(ChapterModel.openRun(_recorded('preview_pf_10_pro')), isNull);
      final done = _recorded('preview_aop_10_pro', (b) => (b['resume'] as Map<String, dynamic>)['done'] = 16);
      expect(ChapterModel.openRun(done), isNull);
    });

    test('the next chapter adds what the dry run with it takes more than the one without it', () {
      expect(ChapterModel.addedMinutes(realMinutes: 20, baseMinutes: 19), 1);
      expect(ChapterModel.addedMinutes(realMinutes: 19, baseMinutes: 20), 0);
      expect(ChapterModel.addedMinutes(realMinutes: 20, baseMinutes: null), 0);
      expect(ChapterModel.addedMinutes(realMinutes: null, baseMinutes: 10), 0);
    });

    test('a row of the shelf that holds one kind opens a run without the other piles', () {
      expect(ChapterModel.onlyPile('questions'), ['cards', 'mistakes', 'lesson']);
      expect(ChapterModel.onlyPile('mistakes'), ['cards', 'questions', 'lesson']);
    });
  });

  group('the length', () {
    test('a length the page offers: 5 to 120 minutes', () {
      expect([for (final m in [null, 0, 4, 5, 10, 120, 121]) ChapterModel.validMinutes(m)], [false, false, false, true, true, true, false]);
    });

    test('a whole hour reads "1 hour"', () {
      expect([for (final m in [5, 35, 45, 60, 90, 120]) ChapterModel.minutesLabel(m)], ['5 min', '35 min', '45 min', '1 hour', '90 min', '2 hours']);
    });

    test('the ready lengths of "Your own" and its step', () {
      expect(ChapterModel.ownPresets, [30, 45, 60]);
      expect((ChapterModel.ownMin, ChapterModel.ownMax, ChapterModel.ownStep), (5, 120, 5));
    });

    test('the Print sheet does not promise a name until the app builds that sheet', () {
      final pro = ChapterModel.shelfView(_recorded('preview_pf_10_pro'), namedSheet: false);
      expect(pro.rows.last.line, '12 Must-know lines');
      expect(ChapterModel.shelfView(_recorded('preview_pf_10_pro')).rows.last.line, '12 Must-know lines, with your name');
    });
  });

  group('the dry run', () {
    ProviderContainer container(ChapterApi api) {
      final c = ProviderContainer(overrides: [learnApiProvider.overrideWithValue(api)]);
      addTearDown(c.dispose);
      return c;
    }

    test('a burst of changes asks once, after the debounce', () {
      fakeAsync((async) {
        final api = ChapterApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        final read = c.read(chapterPreviewProvider(l2Aop).notifier);
        read.want(minutes: 10);
        async.elapse(const Duration(milliseconds: 60));
        read.want(minutes: 5);
        async.elapse(const Duration(milliseconds: 60));
        read.want(minutes: 20);
        async.elapse(const Duration(milliseconds: 100));
        expect(api.previews, isEmpty, reason: 'still inside the debounce of the last change');
        async.elapse(const Duration(milliseconds: 40));
        async.flushMicrotasks();
        expect(api.previews.map((k) => k.minutes), [20]);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.ready);
        sub.close();
      });
    });

    test('the first ask of a page goes at once, with no debounce to wait out', () {
      fakeAsync((async) {
        final api = ChapterApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        c.read(chapterPreviewProvider(l2Aop).notifier).want(minutes: 10, immediate: true);
        async.flushMicrotasks();
        expect(api.previews.map((k) => k.minutes), [10]);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.ready);
        sub.close();
      });
    });

    test('before the first answer the page is loading, with no numbers', () {
      fakeAsync((async) {
        final c = container(ChapterApi());
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.loading);
        c.read(chapterPreviewProvider(l2Aop).notifier).want(minutes: 10);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.loading);
        expect(c.read(chapterPreviewProvider(l2Aop)).data, isNull);
        sub.close();
      });
    });

    test('the last numbers stay while a new answer is on its way, and an older answer that lands late is dropped', () {
      fakeAsync((async) {
        final api = _HeldApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        final notifier = c.read(chapterPreviewProvider(l2Aop).notifier);
        notifier.want(minutes: 10);
        async.elapse(const Duration(milliseconds: 130));
        api.held.last.$2.complete(_recorded('preview_aop_10_pro'));
        async.flushMicrotasks();
        var read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data?.minutes, read.asked?.minutes), (ChapterReadStatus.ready, 10, 10));

        // Ask for 5, then for 20 before the 5 has come back.
        notifier.want(minutes: 5);
        async.elapse(const Duration(milliseconds: 130));
        notifier.want(minutes: 20);
        async.elapse(const Duration(milliseconds: 130));
        read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data?.minutes), (ChapterReadStatus.refreshing, 10), reason: 'the 10-minute numbers stay on screen');
        expect(api.held.map((h) => h.$1.minutes), [10, 5, 20]);

        // The 20 lands, then the late 5: the newest ask wins and is kept.
        api.held[2].$2.complete(_recorded('preview_aop_20_pro'));
        async.flushMicrotasks();
        api.held[1].$2.complete(_recorded('preview_aop_5_pro'));
        async.flushMicrotasks();
        read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data?.minutes, read.asked?.minutes), (ChapterReadStatus.ready, 20, 20));
        sub.close();
      });
    });

    test('a late answer for an ask that is no longer wanted is dropped even when it lands first', () {
      fakeAsync((async) {
        final api = _HeldApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        final notifier = c.read(chapterPreviewProvider(l2Aop).notifier);
        notifier.want(minutes: 10);
        async.elapse(const Duration(milliseconds: 130));
        notifier.want(minutes: 20);
        // The 10 comes back while the 20 waits in its debounce.
        api.held.first.$2.complete(_recorded('preview_aop_10_pro'));
        async.flushMicrotasks();
        expect(c.read(chapterPreviewProvider(l2Aop)).data, isNull);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.loading);
        sub.close();
      });
    });

    test('a failed new answer leaves the old numbers, marked stale; with no numbers it is an error; Try again asks at once', () {
      fakeAsync((async) {
        final api = ChapterApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        final notifier = c.read(chapterPreviewProvider(l2Aop).notifier);
        api.error = true;
        notifier.want(minutes: 10);
        async.elapse(const Duration(milliseconds: 130));
        async.flushMicrotasks();
        var read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data), (ChapterReadStatus.error, null));
        expect(read.error, isA<LearnError>());

        api.error = false;
        notifier.retry();
        async.flushMicrotasks();
        read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data?.minutes), (ChapterReadStatus.ready, 10));

        api.error = true;
        notifier.want(minutes: 20);
        async.elapse(const Duration(milliseconds: 130));
        async.flushMicrotasks();
        read = c.read(chapterPreviewProvider(l2Aop));
        expect((read.status, read.data?.minutes), (ChapterReadStatus.stale, 10), reason: 'the last lined-up run is shown');
        sub.close();
      });
    });

    test('putting a pile back before the new answer comes needs no new ask', () {
      fakeAsync((async) {
        final api = ChapterApi();
        final c = container(api);
        final sub = c.listen(chapterPreviewProvider(l2Aop), (_, _) {});
        final notifier = c.read(chapterPreviewProvider(l2Aop).notifier);
        notifier.want(minutes: 10);
        async.elapse(const Duration(milliseconds: 130));
        async.flushMicrotasks();
        expect(api.previews.length, 1);
        notifier.want(minutes: 10, leaveOut: const ['questions']);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.refreshing);
        notifier.want(minutes: 10);
        expect(c.read(chapterPreviewProvider(l2Aop)).status, ChapterReadStatus.ready);
        async.elapse(const Duration(milliseconds: 300));
        async.flushMicrotasks();
        expect(api.previews.length, 1);
        sub.close();
      });
    });
  });
}
