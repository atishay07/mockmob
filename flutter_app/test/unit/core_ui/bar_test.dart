// The bar (docs/brain/ui-phase2/DOCK.md 9.3): slots, scrubbing, the capsule's priority and
// stand-downs, dismissal, badges, insets, semantics and the accessibility guidelines. Plus the
// Start sheet robustness fixes (today-01, today-03) and the morph's content timing (C8).
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show DebugSemanticsDumpOrder, SemanticsAction, SemanticsNode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/session_draft.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart' show latestSessionDraftProvider;
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fixtures.dart';

class _Driver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

Widget _bar({int branch = 0, ValueChanged<int>? onTab, BarBadges badges = BarBadges.none}) =>
    Align(alignment: Alignment.bottomCenter, child: MmBottomBar(currentBranch: branch, badges: badges, onTab: onTab ?? (_) {}, onStart: (_) {}));

const _resume = BarResume(sessionId: 's1', paper: 'Accountancy mock', total: 50, answered: 23);
const _marked = BarMarked(attemptId: 'a8', paper: 'Mock 8', subject: 'Accountancy');

void main() {
  group('slots', () {
    test('slots 0, 1, 3 and 4 open branches 0 to 3; slot 2 is Start', () {
      expect([for (var s = 0; s < kBarSlots; s++) slotToBranch(s)], [0, 1, null, 2, 3]);
      for (var b = 0; b < 4; b++) {
        expect(slotToBranch(branchToSlot(b)), b);
      }
    });

    test('the geometry of 3.1 holds at 320, 360, 384 and 411', () {
      for (final (screen, bar, start, tab) in const [(320.0, 288.0, 68.0, 52.0), (360.0, 328.0, 76.0, 60.0), (384.0, 352.0, 76.0, 66.0), (411.0, 379.0, 76.0, 72.75)]) {
        final geo = BarGeometry(screen);
        expect(geo.width, bar, reason: '$screen');
        expect(geo.startSlot, start, reason: '$screen');
        expect(geo.tabSlot, closeTo(tab, 0.001), reason: '$screen');
        expect(geo.slotLeft(4) + geo.slotWidth(4), closeTo(bar - MmBar.pad, 0.001));
      }
      expect(BarGeometry(1000).width, MmBar.maxWidth);
    });

    test('the nearest tab is never Start', () {
      final geo = BarGeometry(360);
      for (var x = 0.0; x < geo.width; x += 2) {
        expect(geo.nearestTabSlot(x), isNot(kStartSlot));
      }
    });
  });

  group('scrubbing', () {
    testWidgets('a drag from Today across Start lands on Review, with a tick per tab crossed', (tester) async {
      final driver = _Driver();
      final taps = <int>[];
      await pumpMockmob(
        tester,
        _bar(onTab: taps.add),
        size: const Size(360, 780),
        overrides: <Override>[hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );
      final geo = BarGeometry(360);
      final left = tester.getTopLeft(find.byType(MmBottomBar)).dx;
      final y = tester.getCenter(find.byType(MmBottomBar)).dy;
      final from = Offset(left + geo.slotCenter(0), y);
      final gesture = await tester.startGesture(from);
      for (var i = 1; i <= 20; i++) {
        await gesture.moveTo(Offset(from.dx + (geo.slotCenter(3) - geo.slotCenter(0)) * i / 20, y));
        await tester.pump(const Duration(milliseconds: 16));
      }
      await gesture.up();
      await tester.pumpAndSettle();
      expect(taps, [2], reason: 'lands on Review (branch 2), never on Start');
      expect(driver.calls.where((c) => c == 'selection').length, 2, reason: 'Practice and Review crossed; Start is not a tab');
    });

    testWidgets('a drag that starts on Start never scrubs', (tester) async {
      final taps = <int>[];
      await pumpMockmob(tester, _bar(onTab: taps.add), size: const Size(360, 780));
      final start = tester.getCenter(find.text('Start'));
      await tester.dragFrom(start, const Offset(120, 0));
      await tester.pumpAndSettle();
      expect(taps, isEmpty);
    });

    testWidgets('a drag that starts inside the back-gesture strip never scrubs', (tester) async {
      final taps = <int>[];
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(systemGestureInsets: const EdgeInsets.symmetric(horizontal: 30)),
            child: _bar(onTab: taps.add),
          ),
        ),
        size: const Size(360, 780),
      );
      final y = tester.getCenter(find.byType(MmBottomBar)).dy;
      await tester.dragFrom(Offset(24, y), const Offset(200, 0));
      await tester.pumpAndSettle();
      expect(taps, isEmpty);
    });
  });

  group('the capsule', () {
    ProviderContainer container({String? sending, BarMarked? marked, BarResume? resume, int? offline}) {
      final c = ProviderContainer(overrides: [
        barSendingInputProvider.overrideWithValue(sending),
        barMarkedInputProvider.overrideWithValue(marked),
        barResumeInputProvider.overrideWithValue(resume),
        barOfflineInputProvider.overrideWithValue(offline),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    test('priority: sending, then marked, then resume, then offline', () {
      expect(container(sending: 'Accountancy mock', marked: _marked, resume: _resume, offline: 3).read(barLiveProvider), isA<BarSending>());
      expect(container(marked: _marked, resume: _resume, offline: 3).read(barLiveProvider), _marked);
      expect(container(resume: _resume, offline: 3).read(barLiveProvider), isA<BarResume>());
      expect(container(offline: 3).read(barLiveProvider), isA<BarOffline>());
      expect(container().read(barLiveProvider), isNull);
    });

    test("Today's hero stands the capsule down on Today only", () {
      expect(visibleLive(_resume, dismissed: const {}, todayCovers: const {BarLiveKind.resume}, onToday: true), isNull);
      expect(visibleLive(_resume, dismissed: const {}, todayCovers: const {BarLiveKind.resume}, onToday: false), _resume);
      expect(visibleLive(_marked, dismissed: const {}, todayCovers: const {BarLiveKind.resume}, onToday: true), _marked);
    });

    test("tonight's move is the lowest state, on Today only", () {
      final move = BarMove(title: 'Accountancy repair', detail: '15 min', onStart: () {});
      expect(visibleLive(null, dismissed: const {}, todayCovers: const {}, onToday: true, move: move), move);
      expect(visibleLive(null, dismissed: const {}, todayCovers: const {}, onToday: false, move: move), isNull);
      expect(visibleLive(_resume, dismissed: const {}, todayCovers: const {}, onToday: true, move: move), _resume);
      // A higher state Today's hero already shows stands down; the move does not take its place
      // only because the hero shows a different thing, so it may (one thing floats at a time).
      expect(visibleLive(_resume, dismissed: const {}, todayCovers: const {BarLiveKind.resume}, onToday: true, move: move), move);
      expect(move.semanticsLabel, "Tonight's move, Accountancy repair, 15 min");
      expect(move.action, 'Start');
    });

    test('a dismissal lasts until the state changes (identity), for this app session', () {
      final c = container();
      c.read(barDismissalsProvider.notifier).dismiss(_resume.identity);
      final dismissed = c.read(barDismissalsProvider);
      expect(visibleLive(_resume, dismissed: dismissed, todayCovers: const {}, onToday: false), isNull);
      const other = BarResume(sessionId: 's2', paper: 'Economics mock', total: 50);
      expect(visibleLive(other, dismissed: dismissed, todayCovers: const {}, onToday: false), other);
      final fresh = container();
      expect(fresh.read(barDismissalsProvider), isEmpty, reason: 'a cold start forgets');
    });

    test('Resume counts down by the minute, rounded up', () {
      final r = BarResume(
        sessionId: 's1',
        paper: 'Accountancy mock',
        total: 50,
        answered: 23,
        endsAt: DateTime(2026, 10, 14, 22, 41),
        now: DateTime(2026, 10, 14, 22, 0, 30),
      );
      expect(r.title, 'Accountancy mock, 23 of 50');
      expect(r.detail, '41 min left');
      expect(r.semanticsLabel, 'Resume Accountancy mock, 23 of 50 answered, 41 minutes left');
    });

    testWidgets('one node with its action and a Dismiss action; a swipe dismisses with a tick', (tester) async {
      final handle = tester.ensureSemantics();
      final driver = _Driver();
      final dismissed = <BarLive>[];
      final acted = <BarLive>[];
      await pumpMockmob(
        tester,
        Center(
          child: LiveCapsule(live: _resume, width: 296, collapse: kAlwaysDismissedAnimation, onAction: acted.add, onDismiss: dismissed.add),
        ),
        size: const Size(360, 780),
        overrides: <Override>[hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver))],
      );
      final node = find.bySemanticsLabel(RegExp(r'^Resume Accountancy mock, 23 of 50 answered\. Resume$'));
      expect(node, findsOneWidget);
      expect(tester.getSemantics(node).getSemanticsData().hasAction(SemanticsAction.customAction), isTrue);
      expect(tester.getSize(find.byType(LiveCapsule)).height, greaterThanOrEqualTo(48));

      await tester.tap(find.byType(LiveCapsule));
      await tester.pump();
      expect(acted, [_resume]);
      expect(driver.calls, ['light']);

      await tester.drag(find.byType(LiveCapsule), const Offset(140, 0));
      await tester.pumpAndSettle();
      expect(dismissed, [_resume]);
      expect(driver.calls.last, 'selection');
      handle.dispose();
    });

    testWidgets('under reduced motion the capsule fades in 120 ms and does not move', (tester) async {
      final live = ValueNotifier<BarLive?>(null);
      addTearDown(live.dispose);
      await pumpMockmob(
        tester,
        Center(
          child: ValueListenableBuilder<BarLive?>(
            valueListenable: live,
            builder: (context, l, _) => LiveCapsule(live: l, width: 296, collapse: kAlwaysDismissedAnimation),
          ),
        ),
        disableAnimations: true,
      );
      live.value = _marked;
      await tester.pump();
      final at = tester.getRect(find.byType(LiveCapsule));
      await tester.pump(const Duration(milliseconds: 60));
      expect(tester.getRect(find.byType(LiveCapsule)), at, reason: 'no rise, no scale');
      await tester.pump(const Duration(milliseconds: 70));
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('badges', () {
    test('real counts only: 9+ above nine, a dot never with a count', () {
      expect(const BarBadges(reviewCount: 3).reviewText, '3');
      expect(const BarBadges(reviewCount: 12).reviewText, '9+');
      expect(const BarBadges().reviewText, isNull);
      expect(const BarBadges(reviewCount: 2, reviewDot: true).showReviewDot, isFalse);
      expect(const BarBadges(reviewDot: true).showReviewDot, isTrue);
    });

    test("Review's dot follows a dismissed Marked capsule until the result is opened", () {
      final c = ProviderContainer(overrides: [barMarkedInputProvider.overrideWithValue(_marked)]);
      addTearDown(c.dispose);
      expect(c.read(barBadgesProvider).showReviewDot, isFalse);
      c.read(barDismissalsProvider.notifier).dismiss(_marked.identity);
      expect(c.read(barBadgesProvider).showReviewDot, isTrue);
    });

    testWidgets('no badge on Today, Practice or Start, and two at most', (tester) async {
      await pumpMockmob(tester, _bar(badges: const BarBadges(reviewCount: 3, youDot: true)));
      expect(find.text('3'), findsOneWidget);
      final today = tester.getRect(find.text('Today'));
      final practice = tester.getRect(find.text('Practice'));
      final badge = tester.getRect(find.text('3'));
      expect(badge.left, greaterThan(practice.right), reason: 'on Review, right of Start');
      expect(badge.left, greaterThan(today.right));
    });
  });

  group('insets', () {
    test('clearance changes only with the capsule', () {
      expect(MmBarInsets.clearanceFor(capsule: false), MmBar.lift + MmBar.height + MmBar.contentGap);
      expect(MmBarInsets.clearanceFor(capsule: true) - MmBarInsets.clearanceFor(capsule: false), 52);
      const child = SizedBox();
      const a = MmBarInsets(showing: true, capsule: false, child: child);
      expect(const MmBarInsets(showing: true, capsule: false, child: child).updateShouldNotify(a), isFalse);
      expect(const MmBarInsets(showing: true, capsule: true, child: child).updateShouldNotify(a), isTrue);
      expect(const MmBarInsets(showing: false, capsule: false, child: child).clearance, 0, reason: 'under the keyboard');
    });

    test("the bar's top edge is found from a page's padding, with or without the capsule", () {
      for (final capsule in [false, true]) {
        final insets = MmBarInsets(showing: true, capsule: capsule, child: const SizedBox());
        expect(insets.barTopAbove(20 + insets.clearance), 20 + MmBar.lift + MmBar.height);
      }
    });
  });

  group('accessibility', () {
    testWidgets('the bar meets the tap-target and label guidelines, Night and Day', (tester) async {
      final handle = tester.ensureSemantics();
      for (final brightness in Brightness.values) {
        await pumpMockmob(tester, _bar(branch: 2, badges: const BarBadges(reviewCount: 3)), brightness: brightness);
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      }
      handle.dispose();
    });

    testWidgets('the capsule meets the tap-target and label guidelines', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, Center(child: LiveCapsule(live: _resume, width: 296, collapse: kAlwaysDismissedAnimation, onAction: (_) {})));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      handle.dispose();
    });

    testWidgets('semantic order runs Today, Practice, Start, Review, You', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, _bar());
      final labels = <String>[];
      void walk(SemanticsNode node) {
        if (node.label.isNotEmpty) labels.add(node.label);
        for (final child in node.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder)) {
          walk(child);
        }
      }

      walk(tester.getSemantics(find.byType(MmBottomBar)));
      final order = [for (final l in labels) if (l.contains(', tab ') || l == MmBottomBar.startSemanticsLabel) l];
      expect(order, [
        'Today, tab 1 of 4',
        'Practice, tab 2 of 4',
        MmBottomBar.startSemanticsLabel,
        'Review, tab 3 of 4',
        'You, tab 4 of 4',
      ]);
      handle.dispose();
    });
  });

  group('the Start morph (MOTION.md C8)', () {
    test('no text while the shape is under 80% of its width, opening or closing', () {
      const key = 60.0;
      for (final sheet in const [300.0, 344.0, 400.0]) {
        for (var t = 0.0; t <= 1.0; t += 0.01) {
          final content = MorphSheetContent.contentIn.transform(t);
          if (content > 0) {
            expect(MorphSheetContent.openWidthShare(t, originWidth: key, sheetWidth: sheet), greaterThanOrEqualTo(0.8), reason: 'opening at $t');
          }
          final closing = t <= MorphSheetContent.contentOutBy ? 0.0 : (t - MorphSheetContent.contentOutBy) / (1 - MorphSheetContent.contentOutBy);
          if (closing > 0) {
            expect(MorphSheetContent.closeWidthShare(t, originWidth: key, sheetWidth: sheet), greaterThanOrEqualTo(0.8), reason: 'closing at $t');
          }
        }
      }
    });
  });

  group('the Start sheet (robustness)', () {
    testWidgets('today-01: a second tap while the sheet leaves does nothing', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, _) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MorphSheetRoute<void>(
                    origin: const Rect.fromLTWH(150, 700, 60, 40),
                    scrim: Colors.black54,
                    reduced: true,
                    builder: (context) => const QuickStartSheet(),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
          GoRoute(path: '/practice', builder: (context, _) => const Scaffold(body: Text('practice page'))),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            resumeDraftProvider.overrideWith((ref) => null),
            resumeOfferProvider.overrideWith((ref) async => null),
            nowProvider.overrideWithValue(() => DateTime(2026, 10, 13, 21, 10)),
          ],
          child: MaterialApp.router(
            theme: buildTheme(Brightness.dark),
            routerConfig: router,
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      final key = find.text('Choose your own in Practice');
      await tester.ensureVisible(key);
      await tester.pumpAndSettle();
      final where = tester.getCenter(key);
      // Two taps, 40 ms apart: the first closes the sheet and goes; the second reaches nothing.
      await tester.tapAt(where);
      await tester.pump(const Duration(milliseconds: 40));
      await tester.tapAt(where);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(router.routerDelegate.currentConfiguration.uri.path, '/practice');
      expect(find.text('practice page'), findsOneWidget, reason: 'the page the sheet opened is not popped by the second tap');
    });

    testWidgets('today-03: Resume stops offering a session once it has ended, with no new draft event', (tester) async {
      var now = DateTime(2026, 10, 14, 22, 39, 50);
      final draft = draftOf(endsAtWallMs: DateTime(2026, 10, 14, 22, 40).millisecondsSinceEpoch, count: 10);
      final c = ProviderContainer(overrides: [
        latestSessionDraftProvider.overrideWith((ref) => Stream<SessionDraft?>.value(draft)),
        nowProvider.overrideWithValue(() => now),
      ]);
      addTearDown(c.dispose);
      final sub = c.listen(resumeDraftProvider, (_, _) {}, fireImmediately: true);
      addTearDown(sub.close);
      await tester.pump();
      expect(c.read(resumeDraftProvider), isNotNull);
      now = DateTime(2026, 10, 14, 22, 40, 1);
      // The provider re-reads itself at the deadline (10 s away), with no draft event.
      await tester.pump(const Duration(seconds: 11));
      expect(c.read(resumeDraftProvider), isNull);
    });
  });
}
