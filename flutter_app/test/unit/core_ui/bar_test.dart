// The bar (docs/brain/ui-phase2/DOCK.md 9.3): slots, scrubbing, the icons and their motion, the
// capsule's priority and stand-downs, dismissal, badges, insets, semantics and the
// accessibility guidelines. Plus the Start sheet robustness fixes (today-01, today-03) and the
// morph's content timing (C8).
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

Widget _bar({int branch = 0, ValueChanged<int>? onTab, BarBadges badges = BarBadges.none, ValueNotifier<bool>? compact}) => Align(
  alignment: Alignment.bottomCenter,
  child: MmBottomBar(currentBranch: branch, badges: badges, compact: compact, onTab: onTab ?? (_) {}, onStart: (_) {}),
);

/// The bar's icon of [kind]: its CustomPaint, its painter, how far it is filled, and its settle.
Finder _iconOf(BarIconKind kind) =>
    find.byWidgetPredicate((w) => w is CustomPaint && w.painter is BarIconPainter && (w.painter! as BarIconPainter).glyph == kind.glyph);

BarIconPainter _painterOf(WidgetTester tester, BarIconKind kind) => tester.widget<CustomPaint>(_iconOf(kind)).painter! as BarIconPainter;

double _onOf(WidgetTester tester, BarIconKind kind) => _painterOf(tester, kind).on.value;

double _scaleOf(WidgetTester tester, BarIconKind kind) =>
    tester.widget<Transform>(find.ancestor(of: _iconOf(kind), matching: find.byType(Transform)).first).transform.getMaxScaleOnAxis();

BarLensPainter _lens(WidgetTester tester) =>
    tester.widgetList<CustomPaint>(find.byType(CustomPaint)).map((w) => w.painter).whereType<BarLensPainter>().first;

const _resume = BarResume(sessionId: 's1', paper: 'Accountancy mock', total: 50, answered: 23);
const _marked = BarMarked(attemptId: 'a8', paper: 'Mock 8', subject: 'Accountancy');

void main() {
  group('slots', () {
    test('five tabs in branch order; Start is the key beside them, not a slot', () {
      expect(kBarSlots, 5);
      for (var b = 0; b < kBarTabs.length; b++) {
        expect(slotToBranch(branchToSlot(b)), b);
      }
      expect([for (final t in kBarTabs) t.label], ['Today', 'Practice', 'Review', 'Colleges', 'You']);
    });

    test('the glass is frost (L33): sigma 32 with a 1.5 saturation lift', () {
      expect(MmBar.blurSigma, 32);
      expect(MmBar.blurSigma, greaterThan(MmElevation.sigmaDock));
      expect(MmBar.saturation, 1.5);
    });
  });

  group('alignment on screen (L31, app-ia 4.5 a to d)', () {
    for (final width in const [360.0, 412.0]) {
      for (final compact in const [false, true]) {
        final name = '${width.toInt()} dp, ${compact ? 'compact' : 'expanded'}';
        testWidgets('$name: icons, labels and the Start key share their lines', (tester) async {
          final notifier = ValueNotifier(compact);
          addTearDown(notifier.dispose);
          await pumpMockmob(tester, _bar(branch: BarBranch.review, compact: notifier), size: Size(width, 780));
          await tester.pumpAndSettle();
          final bar = tester.getRect(find.byType(MmBottomBar));
          final geo = BarGeometry(width);
          final e = compact ? 1.0 : 0.0;
          // (a) every icon centre, Start's glyph included, on one y, each centred on its slot.
          final iconYs = <double>[
            for (final kind in BarIconKind.values) tester.getRect(_iconOf(kind)).center.dy,
            tester.getRect(find.byIcon(kStartGlyph)).center.dy,
          ];
          for (final y in iconYs) {
            expect(y, closeTo(bar.top + geo.iconRect(0, collapse: e).center.dy, 0.5));
          }
          for (final kind in BarIconKind.values) {
            expect(tester.getRect(_iconOf(kind)).center.dx, closeTo(bar.left + geo.slotCenter(branchToSlot(kind.index)), 0.5), reason: '$kind');
          }
          expect(tester.getRect(find.byIcon(kStartGlyph)).center.dx, closeTo(bar.left + geo.keyBox.center.dx, 0.5));
          // (b) every label box, Start's word included, on one y (labels fade out when compact).
          if (!compact) {
            for (final label in [...kBarTabs.map((t) => t.label), StartKeyFace.word]) {
              final rect = tester.getRect(find.text(label));
              expect(rect.center.dy, closeTo(bar.top + MmBar.labelTop + MmBar.labelHeight / 2, 0.5), reason: label);
            }
          }
          // (c) the Start key's circle shares the capsule's top and bottom; the lens rests on Review.
          final startBox = tester.getRect(find.byType(StartKeyFace));
          final circle = StartKeyFace.keyRect(startBox.size, e).shift(startBox.topLeft - bar.topLeft);
          final capsule = geo.capsuleShape(e).outerRect;
          expect(circle.top, closeTo(capsule.top, 0.01));
          expect(circle.bottom, closeTo(capsule.bottom, 0.01));
          final lens = geo.lensRect(branchToSlot(BarBranch.review), collapse: e);
          final painted = _lens(tester);
          final review = lens;
          expect(painted.left.value, closeTo(review.left, 0.01));
          expect(painted.right.value, closeTo(review.right, 0.01));
          // (d) the content group centres on the pill (compact: the icons do).
          if (!compact) {
            final icon = tester.getRect(_iconOf(BarIconKind.today));
            final group = (icon.top + bar.top + MmBar.labelTop + MmBar.labelHeight) / 2;
            expect(group, closeTo(bar.top + lens.center.dy, 0.5));
          } else {
            expect(iconYs.first, closeTo(bar.top + lens.center.dy, 0.5));
          }
        });
      }
    }

    testWidgets('at 1.3x text, Practice, Colleges and Start stay on one line inside their boxes', (tester) async {
      await pumpMockmob(tester, _bar(), size: const Size(360, 780), textScale: 1.3);
      final geo = BarGeometry(360);
      final bar = tester.getRect(find.byType(MmBottomBar));
      for (final label in const ['Practice', 'Colleges', 'Start']) {
        final rect = tester.getRect(find.text(label));
        expect(rect.height, lessThanOrEqualTo(MmBar.labelHeight + 0.01), reason: '$label never wraps');
        expect(rect.width, lessThanOrEqualTo((label == 'Start' ? StartKeyFace.labelWidth : geo.labelBoxWidth) + 0.01), reason: label);
        expect(rect.center.dy, closeTo(bar.top + MmBar.labelTop + MmBar.labelHeight / 2, 0.5), reason: label);
      }
    });

    testWidgets('a pressed tab sinks to 0.96 and comes back', (tester) async {
      await pumpMockmob(tester, _bar(), size: const Size(360, 780));
      final gesture = await tester.startGesture(tester.getCenter(find.text('Colleges')));
      await tester.pump(const Duration(milliseconds: 120));
      final pressed = tester.widgetList<AnimatedScale>(find.byType(AnimatedScale)).where((w) => w.scale != 1);
      expect(pressed.single.scale, MmBottomBar.tabPressScale);
      await gesture.up();
      await tester.pumpAndSettle();
      expect(tester.widgetList<AnimatedScale>(find.byType(AnimatedScale)).every((w) => w.scale == 1), isTrue);
    });
  });

  group('scrubbing', () {
    testWidgets('a drag from Today lands on Colleges, with a tick per tab crossed', (tester) async {
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
      // The finger rests before it lifts, so no flick is projected.
      await tester.pump(const Duration(milliseconds: 120));
      await gesture.up();
      await tester.pumpAndSettle();
      expect(taps, [3], reason: 'lands on Colleges (branch 3)');
      expect(driver.calls.where((c) => c == 'selection').length, 3, reason: 'Practice, Review and Colleges crossed');
    });

    testWidgets('a drag that starts on the Start key never scrubs the tabs', (tester) async {
      final taps = <int>[];
      await pumpMockmob(tester, _bar(onTab: taps.add), size: const Size(360, 780));
      final start = tester.getCenter(find.text('Start'));
      await tester.dragFrom(start, const Offset(-120, 0));
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

  group('icons (DOCK.md 4, revised after the owner review on 14 Oct)', () {
    test('one family: filled Rounded when active, outlined at rest, from the Material font', () {
      expect(BarIconKind.today.glyph, const BarGlyph(active: Icons.home_rounded, idle: Icons.home_outlined));
      expect(BarIconKind.practice.glyph, const BarGlyph(active: Icons.quiz_rounded, idle: Icons.quiz_outlined));
      expect(BarIconKind.review.glyph, const BarGlyph(active: Icons.fact_check_rounded, idle: Icons.fact_check_outlined));
      expect(BarIconKind.colleges.glyph, const BarGlyph(active: Icons.account_balance_rounded, idle: Icons.account_balance_outlined));
      expect(BarIconKind.you.glyph, const BarGlyph(active: Icons.person_rounded, idle: Icons.person_outlined));
      for (final kind in BarIconKind.values) {
        expect(kind.glyph.active.fontFamily, 'MaterialIcons', reason: '$kind: no icon package');
        expect(kind.glyph.idle.fontFamily, 'MaterialIcons');
        expect(kind.glyph.active, isNot(kind.glyph.idle), reason: '$kind: the active state is a shape, not only a colour');
      }
      expect([for (final t in kBarTabs) t.icon], BarIconKind.values, reason: 'Today, Practice, Review, Colleges, You');
    });

    test('colours: ink when active in both themes (the one lime is the Start key), ink 2 at rest', () {
      final night = BarIconColors.of(MmColors.dark);
      expect(night.active, const Color(0xFFF4F0E6));
      expect(night.active, isNot(MmColors.dark.volt));
      expect(night.idle, const Color(0xFFBDB6A6));
      final day = BarIconColors.of(MmColors.light);
      expect(day.active, const Color(0xFF17150F));
      expect(day.idle, const Color(0xFF454036));
      expect(day.active, isNot(MmColors.light.volt));
    });

    test('the fill leads and the outline holds, so the shape never thins mid-way', () {
      expect(BarIconPainter.fillAt(0), 0);
      expect(BarIconPainter.outlineAt(0), 1);
      expect(BarIconPainter.fillAt(1), 1);
      expect(BarIconPainter.outlineAt(1), 0);
      for (var t = 0.0; t <= 1.0; t += 0.02) {
        expect(BarIconPainter.fillAt(t) + BarIconPainter.outlineAt(t), greaterThanOrEqualTo(1 - 1e-9), reason: 'at $t');
      }
    });

    testWidgets('You is a person shape, never the initial (the header avatar has it)', (tester) async {
      await pumpMockmob(tester, _bar(branch: BarBranch.you));
      expect(_painterOf(tester, BarIconKind.you).glyph, const BarGlyph(active: Icons.person_rounded, idle: Icons.person_outlined));
      expect(_onOf(tester, BarIconKind.you), 1);
      expect(kStartGlyph, Icons.play_arrow_rounded, reason: 'Start is a play triangle, never the retired bolt');
    });

    testWidgets('arrival waits for the lens (70% of its travel), fills over 200 ms and settles from 0.9; departure empties over 160 ms', (tester) async {
      final branch = ValueNotifier(1);
      addTearDown(branch.dispose);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<int>(valueListenable: branch, builder: (context, b, _) => _bar(branch: b)),
        size: const Size(360, 780),
      );
      expect(_onOf(tester, BarIconKind.practice), 1);
      expect(_onOf(tester, BarIconKind.review), 0);

      final geo = BarGeometry(360);
      final from = geo.lensEdges(1).$2;
      final to = geo.lensEdges(2).$2;
      branch.value = 2;
      await tester.pump();
      int? arrivedAt;
      var lowest = 1.0;
      var highest = 0.0;
      for (var t = 4; t <= 800; t += 4) {
        await tester.pump(const Duration(milliseconds: 4));
        final review = _onOf(tester, BarIconKind.review);
        final practice = _onOf(tester, BarIconKind.practice);
        if (arrivedAt == null && review > 0) {
          arrivedAt = t;
          final lead = (_lens(tester).right.value - from) / (to - from);
          expect(lead, greaterThanOrEqualTo(0.7), reason: 'no volt on the target before the lens arrives');
        }
        if (t == 80) expect(practice, inExclusiveRange(0, 1), reason: 'the old icon is emptying');
        if (t >= 168) expect(practice, 0, reason: 'empties over 160 ms');
        final a = arrivedAt;
        if (a != null) {
          final scale = _scaleOf(tester, BarIconKind.review);
          lowest = scale < lowest ? scale : lowest;
          highest = scale > highest ? scale : highest;
          if (t - a <= 180) expect(review, lessThan(1), reason: 'still filling at ${t - a} ms');
          if (t - a >= 200) expect(review, 1, reason: 'filled by 200 ms');
        }
      }
      expect(arrivedAt, isNotNull);
      expect(lowest, inInclusiveRange(0.9, 0.92), reason: 'settles from 0.9');
      expect(highest, lessThanOrEqualTo(1.01), reason: 'a calm spring, no visible overshoot');
      expect(_scaleOf(tester, BarIconKind.review), closeTo(1, 0.001));
    });

    testWidgets('under reduced motion the icons swap at once', (tester) async {
      final branch = ValueNotifier(0);
      addTearDown(branch.dispose);
      await pumpMockmob(
        tester,
        ValueListenableBuilder<int>(valueListenable: branch, builder: (context, b, _) => _bar(branch: b)),
        disableAnimations: true,
      );
      branch.value = 2;
      await tester.pump();
      expect(_onOf(tester, BarIconKind.review), 1);
      expect(_onOf(tester, BarIconKind.today), 0);
      expect(_scaleOf(tester, BarIconKind.review), 1);
    });

    testWidgets('labels are w600 active or not, so nothing shifts', (tester) async {
      await pumpMockmob(tester, _bar(branch: 2));
      for (final label in const ['Today', 'Practice', 'Review', 'Colleges', 'You']) {
        expect(tester.widget<Text>(find.text(label)).style!.fontWeight, FontWeight.w600, reason: label);
      }
    });

    testWidgets('icons are never clipped: 320 dp, compact, and text at 1.3x and 2.0x', (tester) async {
      for (final (width, compact, scale) in const [
        (320.0, false, 1.0),
        (320.0, true, 2.0),
        (320.0, false, 2.0),
        (360.0, false, 1.3),
        (360.0, true, 1.3),
        (411.0, false, 2.0),
      ]) {
        final notifier = ValueNotifier(compact);
        addTearDown(notifier.dispose);
        await pumpMockmob(tester, _bar(branch: 3, compact: notifier), size: Size(width, 780), textScale: scale);
        await tester.pumpAndSettle();
        final bar = tester.getRect(find.byType(MmBottomBar));
        final painted = Rect.fromLTRB(bar.left, bar.bottom - (compact ? MmBar.compactHeight : MmBar.height), bar.right, bar.bottom);
        final geo = BarGeometry(width);
        final why = '$width dp, ${compact ? 'compact' : 'expanded'}, text ${scale}x';
        for (final kind in BarIconKind.values) {
          final icon = tester.getRect(_iconOf(kind));
          final slot = branchToSlot(kind.index);
          final slotLeft = bar.left + geo.slotLeft(slot);
          final slotRight = slotLeft + geo.slot;
          // Slots are a third of a dp wide at some widths, so compare to a hundredth.
          expect(icon.width, closeTo(24, 0.01), reason: '$kind never scales with text, $why');
          expect(icon.height, closeTo(24, 0.01), reason: '$kind never scales with text, $why');
          expect(icon.left, greaterThanOrEqualTo(slotLeft - 0.01), reason: '$kind, $why');
          expect(icon.right, lessThanOrEqualTo(slotRight + 0.01), reason: '$kind, $why');
          expect(icon.top, greaterThanOrEqualTo(painted.top + 4), reason: '$kind inside the glass, $why');
          expect(icon.bottom, lessThanOrEqualTo(painted.bottom - 4), reason: '$kind inside the glass, $why');
          if (!compact) {
            final name = kBarTabs[kind.index].label;
            final label = tester.getRect(find.text(name));
            expect(label.left, greaterThanOrEqualTo(slotLeft - 0.01), reason: '$name, $why');
            expect(label.right, lessThanOrEqualTo(slotRight + 0.01), reason: '$name, $why');
            expect(label.top, greaterThanOrEqualTo(icon.bottom - 0.01), reason: '$name, $why');
            expect(label.bottom, lessThanOrEqualTo(painted.bottom), reason: '$name, $why');
          }
        }
      }
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
      expect(badge.left, greaterThan(practice.right), reason: 'on Review, right of Practice');
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

    testWidgets('semantic order runs Today, Practice, Review, Colleges, You, then Start', (tester) async {
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
        'Today, tab 1 of 5',
        'Practice, tab 2 of 5',
        'Review, tab 3 of 5',
        'Colleges, tab 4 of 5',
        'You, tab 5 of 5',
        MmBottomBar.startSemanticsLabel,
      ]);
      handle.dispose();
    });

    testWidgets('each tab is a button, and only the open one is selected', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(tester, _bar(branch: 2));
      for (final (label, selected) in const [
        ('Today, tab 1 of 5', false),
        ('Practice, tab 2 of 5', false),
        ('Review, tab 3 of 5', true),
        ('Colleges, tab 4 of 5', false),
        ('You, tab 5 of 5', false),
      ]) {
        expect(
          tester.getSemantics(find.bySemanticsLabel(label)),
          isSemantics(label: label, isButton: true, isSelected: selected, hasTapAction: true),
        );
      }
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
