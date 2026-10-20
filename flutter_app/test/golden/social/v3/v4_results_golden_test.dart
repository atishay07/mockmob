// Mob V4 results track goldens (MOB-MINIMAL 3.3, 3.4, 4.2, 4.3; MOB-V4-BUILD 1):
// - A9 the Full mock together lobby: the facts row, the "For you" card (included with Pro, credits, short of
//   credits) with the server's price and its keys, Night and Day at text scale 1.0 and 1.3 (360 dp);
// - the 4.3 frame strips inside a results run: quest done, week stitched with Mob hours (crown and ticks), and the
//   parcel, each at its beats, plus the reduced-motion end; Night and Day;
// - the 4.2 den acts (a friend joins, a reaction, sitting at the desk and back) as frame strips, with reduced motion.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/moment_overlay.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';
import 'package:mockmob/features/social/v3/widgets/mock_for_you.dart';
import 'package:mockmob/features/social/v3/widgets/moment_stitched.dart';
import 'package:mockmob/features/social/v3/widgets/results_parts.dart';

import '../../../helpers/golden_harness.dart';
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/moment_test_kit.dart';
import '../../you/you_golden_kit.dart' show setUpGoldenFonts;

String _tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';
String _ts(double s) => s == 1 ? '' : '_ts13';

/// The Chai Circle fixture's week of Mob hours: Riya on top (6 h 20 m), ticks for Riya, you and Zoya; Kabir shares
/// but met his goal on 3 days (no tick).
StitchHours fixtureHours(MobV3 v3) {
  String idOf(String name) => v3.members.firstWhere((m) => m.name == name, orElse: () => v3.members.first).memberId;
  final you = v3.members.firstWhere((m) => m.you).memberId;
  return StitchHours.fromJson({
    'top_member_id': idOf('Riya'),
    'members': [
      {'member_id': idOf('Riya'), 'minutes': 380, 'goal_days': 6},
      {'member_id': you, 'minutes': 290, 'goal_days': 5},
      {'member_id': idOf('Kabir'), 'minutes': 95, 'goal_days': 3},
      {'member_id': idOf('Zoya'), 'minutes': 150, 'goal_days': 5},
    ],
  })!;
}

/// A moment inside a results run (step [index] of 6), as the run shows it.
class _RunHost extends StatelessWidget {
  const _RunHost(this.which, this.index);
  final ValueNotifier<String?> which;
  final int index;

  @override
  Widget build(BuildContext context) => RunStep(index: index, total: 6, onNext: () {}, onExit: () {}, child: MomentHost(which));
}

Future<ValueNotifier<String?>> _pumpRun(WidgetTester t, {required Brightness b, required int index, bool reduced = false, double scale = 1}) async {
  loadFoldManifestForTest();
  final server = v3Server(scenario: 'questdone');
  final which = ValueNotifier<String?>(null);
  addTearDown(which.dispose);
  await pumpMockmob(t, _RunHost(which, index), brightness: b, size: const Size(360, 780), textScale: scale, wrapInScaffold: false, disableAnimations: reduced, overrides: v3Overrides(server));
  return which;
}

Future<void> _shoot(WidgetTester t, String file) async {
  await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_results/$file.png'));
  await t.pump(const Duration(milliseconds: 100));
}

class _Lobby extends StatelessWidget {
  const _Lobby(this.forYou);
  final MockForYou forYou;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text("Kabir's full mock", style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: c.onSurface)),
              const SizedBox(height: 16),
              MockLobbyBody(forYou: forYou, sitCredits: 50),
              const SizedBox(height: 24),
              MockLobbyKeys(forYou: forYou, onSit: () {}, onAddCredits: () {}, onPro: () {}, onNotNow: () {}),
            ],
          ),
        ),
      ),
    );
  }
}

void main() {
  setUpGoldenFonts();
  setUpAll(() {
    loadFoldManifestForTest();
    FoilSheenProgram.enabled = false;
  });
  setUp(() => StitchHours.of = fixtureHours);
  tearDown(() => StitchHours.of = (_) => null);

  for (final b in [Brightness.dark, Brightness.light]) {
    // ---- A9 the lobby ----
    for (final scale in [1.0, 1.3]) {
      for (final (name, forYou) in <(String, MockForYou)>[
        ('included', MockForYou.of(costCredits: 0, pro: true)!),
        ('credits', MockForYou.of(costCredits: 50, pro: false, balance: 120)!),
        ('short', MockForYou.of(costCredits: 50, pro: false, balance: 30)!),
      ]) {
        testWidgets('A9 lobby $name (${_tag(b)}${_ts(scale)})', (t) async {
          await pumpMockmob(t, _Lobby(forYou), brightness: b, size: const Size(360, 780), textScale: scale, wrapInScaffold: false);
          await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_results/a9_lobby_${name}_360_${_tag(b)}${_ts(scale)}.png'));
        });
      }
    }

    // ---- Week stitched with Mob hours, end state at 1.0 and 1.3 ----
    for (final scale in [1.0, 1.3]) {
      testWidgets('week stitched with Mob hours in the run (${_tag(b)}${_ts(scale)})', (t) async {
        final which = await _pumpRun(t, b: b, index: 4, scale: scale);
        await startMoment(t, which, _key('stitch'));
        await pumpTo(t, 2200);
        expect(find.byKey(const ValueKey('k3-hours')), findsOneWidget);
        await _shoot(t, 'week_hours_360_${_tag(b)}${_ts(scale)}');
      });
    }

    // ---- 4.3 frame strips inside the run ----
    for (final (name, index, key, frames) in <(String, int, String Function(), List<int>)>[
      ('quest', 3, () => _key('quest'), [0, 600, 1120, 1400, 1900]),
      ('week', 4, () => _key('stitch'), [0, 400, 780, 1300, 2000]),
      ('parcel', 5, () => 'reveal:hop', [300, 700, 900, 1240, 1620, 2000]),
    ]) {
      testWidgets('4.3 $name frames in the run (${_tag(b)})', (t) async {
        final which = await _pumpRun(t, b: b, index: index);
        await startMoment(t, which, key());
        var at = 0;
        for (final f in frames) {
          await pumpTo(t, f, from: at);
          at = f + 100;
          await _shoot(t, 'strip_${name}_${f.toString().padLeft(4, '0')}_${_tag(b)}');
        }
      });

      testWidgets('4.3 $name reduced motion (${_tag(b)})', (t) async {
        final which = await _pumpRun(t, b: b, index: index, reduced: true);
        await startMoment(t, which, key());
        await pumpTo(t, 400);
        await _shoot(t, 'strip_${name}_reduced_${_tag(b)}');
      });
    }

    // ---- 4.2 den acts as frame strips ----
    for (final reduced in [false, true]) {
      testWidgets('4.2 den acts strip (${_tag(b)}${reduced ? '_reduced' : ''})', (t) async {
        await pumpMockmob(t, _ActsStrip(reduced: reduced), brightness: b, size: const Size(720, 560), wrapInScaffold: false);
        await settleImages(t);
        await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/v4_results/acts_strip_${_tag(b)}${reduced ? '_reduced' : ''}.png'));
      });
    }
  }

  group('StitchHours (tolerant parse, D174 rules)', () {
    final mob = [
      const MobV3Member(memberId: 'a', name: 'Riya'),
      const MobV3Member(memberId: 'b', name: 'Zoya'),
      const MobV3Member(memberId: 'me', name: 'Ann', you: true),
    ];
    test('absent or not a map: no card', () {
      expect(StitchHours.fromJson(null), isNull);
      expect(StitchHours.fromJson('x'), isNull);
    });
    test('an empty members list shows nothing', () {
      final h = StitchHours.fromJson({'top_member_id': 'a', 'members': <Object>[]})!;
      expect(h.crownIn(mob), isNull);
      expect(h.showsIn(mob), isFalse);
    });
    test('a null top member: no crown, ticks still show', () {
      final h = StitchHours.fromJson({
        'members': [
          {'member_id': 'b', 'minutes': 40, 'goal_days': 5},
        ],
      })!;
      expect(h.crownIn(mob), isNull);
      expect(h.showsIn(mob), isTrue);
    });
    test('a crown only for a top member with minutes who is in the Mob; 0 minutes never listed', () {
      final h = StitchHours.fromJson({
        'topMemberId': 'gone',
        'members': [
          {'memberId': 'gone', 'minutes': 500},
          {'memberId': 'a', 'minutes': 0, 'goalDays': 7},
        ],
      })!;
      expect(h.crownIn(mob), isNull);
      expect(h.shownIn(mob), isEmpty);
      expect(h.showsIn(mob), isFalse);
    });
    test('minutes read as hours and minutes', () {
      expect(MobV4ResultsCopy.hm(380), '6 h 20 m');
      expect(MobV4ResultsCopy.hm(45), '45 m');
    });
  });

  group('MockForYou (A9, server numbers only)', () {
    test('no price sent: no card', () => expect(MockForYou.of(costCredits: null, pro: false), isNull));
    test('Pro, nothing to pay: included', () => expect(MockForYou.of(costCredits: 0, pro: true), isA<MockIncluded>()));
    test('Free with nothing to pay (already begun): no card', () => expect(MockForYou.of(costCredits: 0, pro: false), isNull));
    test('Free with enough credits', () => expect(MockForYou.of(costCredits: 50, pro: false, balance: 50), isA<MockCredits>()));
    test('Free short, or refused by the server (MOCK_CREDITS)', () {
      expect(MockForYou.of(costCredits: 50, pro: false, balance: 30), isA<MockShort>());
      expect(MockForYou.of(costCredits: 50, pro: false, balance: 500, refused: true), isA<MockShort>());
    });
    test('the general rule names only what the server sent', () {
      expect(MockForYouCard.ruleFor(50, true), 'Pro members start full mocks, and anyone in the Mob can sit them. Pro members sit free. Free members pay 50 credits.');
      expect(MockForYouCard.ruleFor(null, true), 'Pro members start full mocks, and anyone in the Mob can sit them. Pro members sit free.');
    });
  });

  group('den acts timelines (4.2)', () {
    test('a friend joins in about 2.3 s: lands squashed 1.12/0.86 and waves', () {
      expect(JoinAct.total, 2300);
      final land = JoinAct.at(JoinAct.land + 90, fromDx: -120);
      expect(land.scaleX, closeTo(1.12, 0.01));
      expect(land.scaleY, closeTo(0.86, 0.01));
      expect(JoinAct.at(1800, fromDx: -120).pose, FoldPose.wave);
      expect(JoinAct.at(JoinAct.total, fromDx: -120).dx, closeTo(0, 0.01));
      expect(JoinAct.at(60, fromDx: -120, reduced: true).dy, 0);
    });
    test('a reaction for four ends in about 1.6 s, 120 ms apart, cheer at the low point', () {
      expect(ReactionAct.totalFor(4), closeTo(1560, 1));
      expect(ReactionAct.at(100, index: 0).pose, FoldPose.cheer);
      expect(ReactionAct.at(100, index: 1).pose, FoldPose.idle);
      expect(ReactionAct.at(270, index: 0).dy, closeTo(-14, 0.5));
      expect(ReactionAct.at(300, index: 0, reduced: true).dy, 0);
    });
    test('to the desk: bulb, then beam, two hops scaling to 0.85, think on landing', () {
      final f = DeskAct.at(DeskAct.total, toDesk: true, deskDx: 80, deskDy: -40);
      expect(f.depth, closeTo(0.85, 0.001));
      expect(f.pose, FoldPose.think);
      expect(DeskAct.at(150, toDesk: true, deskDx: 80, deskDy: -40).bulb, 1);
      expect(DeskAct.at(150, toDesk: true, deskDx: 80, deskDy: -40).beam, 0);
      final back = DeskAct.at(DeskAct.backTotal, toDesk: false, deskDx: 80, deskDy: -40);
      expect(back.dx, closeTo(0, 0.01));
      expect(back.bulb, 0);
    });
  });
}

String _key(String kind) {
  final server = v3Server(scenario: 'questdone');
  return kind == 'quest' ? questKey(server) : stitchKey(server);
}

/// Each act at its beats, one row per act: the Fold drawn with the frame's pose and moved by [ActTransform], with the
/// act's props (seat outline, lamp bulb and beam, tag) as simple marks so the strip reads alone.
class _ActsStrip extends StatelessWidget {
  const _ActsStrip({required this.reduced});
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    final rows = <(String, List<double>, ActFrame Function(double))>[
      ('A friend joins', [0, 240, 480, 720, 960, 1050, 1300, 1800, 2300], (ms) => JoinAct.at(ms, fromDx: -60, reduced: reduced)),
      ('A reaction', [0, 45, 90, 270, 450, 540, 800, 1200], (ms) => ReactionAct.at(ms, index: 0, reduced: reduced)),
      ('To the desk', [0, 150, 450, 700, 950, 1200, 1450, 1700], (ms) => DeskAct.at(ms, toDesk: true, deskDx: 24, deskDy: -18, reduced: reduced)),
      ('Back from the desk', [0, 300, 600, 850, 1100, 1350, 1600], (ms) => DeskAct.at(ms, toDesk: false, deskDx: 24, deskDy: -18, reduced: reduced)),
    ];
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (label, times, frameAt) in rows) ...[
              Text('$label${reduced ? ' (reduced motion)' : ''}', style: TextStyle(fontSize: 11, color: ink, fontWeight: FontWeight.w700)),
              SizedBox(
                height: 112,
                child: Row(
                  children: [
                    for (final ms in times)
                      Expanded(
                        child: Column(
                          children: [
                            SizedBox(
                              height: 92,
                              child: Stack(
                                clipBehavior: Clip.none,
                                alignment: Alignment.bottomCenter,
                                children: [
                                  // The seat outline (join) folding away.
                                  Positioned(bottom: 0, child: Opacity(opacity: frameAt(ms).seat.clamp(0.0, 1.0), child: Container(width: 44, height: 6, decoration: BoxDecoration(border: Border.all(color: ink.withValues(alpha: 0.4)), borderRadius: BorderRadius.circular(3))))),
                                  // The desk lamp: bulb and beam.
                                  Positioned(top: 0, right: 2, child: Opacity(opacity: frameAt(ms).bulb.clamp(0.0, 1.0), child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFFF2A93B), shape: BoxShape.circle)))),
                                  Positioned(top: 8, right: 0, child: Opacity(opacity: (frameAt(ms).beam * 0.35).clamp(0.0, 1.0), child: Container(width: 30, height: 60, color: const Color(0xFFF2A93B)))),
                                  ActTransform(
                                    frame: frameAt(ms),
                                    child: FoldPuppet(fold: FoldKey.hop, size: 56, pose: frameAt(ms).pose, shadow: false, blink: false),
                                  ),
                                  Positioned(bottom: -2, child: Opacity(opacity: frameAt(ms).tag.clamp(0.0, 1.0), child: Text('studying', style: TextStyle(fontSize: 8, color: ink)))),
                                ],
                              ),
                            ),
                            Text('${ms.round()} ms', style: TextStyle(fontSize: 8, color: ink.withValues(alpha: 0.7))),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
            ],
          ],
        ),
      ),
    );
  }
}
