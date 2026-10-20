// Version 13 build blockers (tmp/review-1020/FIX-WAVE-LENSES-1020.md L-01 to L-12 and the app surface reviews), held by
// tests: the Pro page prices only what the server says (L-05), sells no live rooms while live is off (L-04) and no
// Pro-only insight the free read already shows (L-12); the Wallet names a doubt and a fix (L-03); links the app opens
// carry the app marker (L-07a); every Fold reveal says how THAT Fold was earned (Mob H1); a doubt with no chapter
// always offers chapters to pick, even on a fresh account (Mobi H1).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/router/external_link_opener.dart';
import 'package:mockmob/features/billing/billing_copy.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/mobi_models.dart';
import 'package:mockmob/features/insights/widgets/doubt_thread.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceChaptersProvider;
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/moment_overlay.dart' show parcelReveal, questPrizeOf;
import 'package:mockmob/features/wallet/wallet_copy.dart';

import '../../helpers/golden_harness.dart';

class _Auth extends AuthController {
  _Auth(this.subjects);
  final List<String> subjects;

  @override
  AuthSnapshot build() => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', subjects: subjects);
}

void main() {
  group('the Pro page prices only what is true', () {
    test('L-05: the first full mock in each subject is free while the server says so; unknown names no price', () {
      String freeCell(bool? firstFree) => BillingCopy.compareRowsFor(firstFree: firstFree).firstWhere((r) => r.$1 == 'Full mocks').$2!;
      expect(freeCell(true), BillingCopy.compareFullMockFirstFree);
      expect(freeCell(false), '50 credits each');
      expect(freeCell(null), 'Uses credits');
      expect(BillingCopy.moment1LineFor(firstFree: true), contains('your first one in each subject is free'));
      expect(BillingCopy.moment1LineFor(firstFree: false), endsWith('On Free, each one costs 50 credits.'));
      expect(BillingCopy.moment1LineFor(firstFree: null), isNot(contains('50 credits')));
    });

    test('L-04: no live rooms are sold while live is off', () {
      final pro = [BillingCopy.proFeatureMob.$2, BillingCopy.alsoMob.$2, ProNudgeCopy.head(ProReason.mobHosting).lede];
      for (final line in [...pro, ...MobV3Copy.proListFor(live: false)]) {
        expect(line.toLowerCase(), isNot(contains('live room')), reason: line);
        expect(line.toLowerCase(), isNot(contains('live or anytime')), reason: line);
      }
      expect(MobV3Copy.proListFor(live: true), contains('Open live rooms.'));
    });

    test('L-12: Insights in detail is the habit across papers; Free has this paper only', () {
      final row = BillingCopy.compareRows.firstWhere((r) => r.$1 == 'Insights in detail');
      expect(row.$2, 'This paper only');
      expect(BillingCopy.proFeatures.firstWhere((f) => f.$1 == 'Insights in detail').$2, contains('every paper'));
    });

    test('L-03 and L-20: the Wallet names a doubt and a fix, never a deeper analysis or a Mobi job', () {
      expect(WalletCopy.buyDoubt, 'A doubt');
      expect(WalletCopy.buyFix, 'A fix');
      expect(BillingCopy.packUse(150), 'Enough for 150 doubts or fixes with Mobi');
      for (final s in [WalletCopy.creditsFor, WalletCopy.buyDoubtNote, WalletCopy.buyFixNote, WalletCopy.costShows]) {
        for (final banned in ['Deeper analysis', 'Mobi job', 'real CUET', '!']) {
          expect(s, isNot(contains(banned)), reason: '$banned in $s');
        }
      }
    });
  });

  group('L-07a: every MockMob page the app opens carries the app marker', () {
    test('our pages get from=app, other sites are left alone', () {
      expect(markAppLink(Uri.parse('https://www.mockmob.in/privacy')).toString(), 'https://www.mockmob.in/privacy?from=app');
      expect(markAppLink(Uri.parse('https://mockmob.in/pyq-guide?subject=accountancy#top')).queryParameters, {'subject': 'accountancy', 'from': 'app'});
      expect(markAppLink(Uri.parse('https://mockmob.in/pyq-guide?subject=accountancy#top')).fragment, 'top');
      expect(markAppLink(Uri.parse('https://cuet.nta.nic.in/notice')).toString(), 'https://cuet.nta.nic.in/notice');
      expect(markAppLink(Uri.parse('https://www.mockmob.in/terms?from=app')).toString(), 'https://www.mockmob.in/terms?from=app');
    });
  });

  group('Mob H1: a Fold reveal says how that Fold was earned', () {
    test('a Mob Fold names the Mob only from its own parcel; a personal Fold is the student\'s own', () {
      expect(MobV3Copy.revealFact('Chai Circle', FoldKey.hop), 'Chai Circle finished its first weekly quest, so everyone in it gets Hop. Nobody can buy him.');
      expect(MobV3Copy.revealFact(null, FoldKey.crane), startsWith('Your Mob fixed 3 traps together'));
      expect(MobV3Copy.revealFact(null, FoldKey.stamp), startsWith("Your Mob's chain reached 4 weeks in a row"));
      expect(MobV3Copy.revealFact('Chai Circle', FoldKey.naav), 'You finished your first full mock, so Naav is yours. Nobody can buy it.');
      for (final f in FoldKey.values) {
        final line = MobV3Copy.revealFact('Chai Circle', f);
        expect(line, isNot(contains('!')));
        if (!{FoldKey.hop, FoldKey.crane, FoldKey.stamp}.contains(f)) expect(line, isNot(contains('quest')), reason: '$f');
      }
    });

    test('a personal reveal is never the parcel; the server\'s parcel wins', () {
      MobV3 v3({required List<String> moments, Map<String, Object?>? parcel}) => MobV3.fromJson({
            'name': {'key': 'chai', 'text': 'Chai Circle'},
            'quest': {'done': true, 'target': 15, 'answered': 15, 'parcel': ?parcel},
            'moments': moments,
          });
      final personal = v3(moments: ['reveal:naav']);
      expect(questPrizeOf(personal).kind, isNot(ParcelKind.fold));
      expect(parcelReveal(personal), isNull, reason: 'Naav plays later on its own, never out of the parcel');
      final both = v3(moments: ['reveal:naav', 'reveal:hop'], parcel: {'kind': 'fold', 'fold': 'hop'});
      expect(questPrizeOf(both).fold, FoldKey.hop);
      expect(parcelReveal(both), 'reveal:hop');
    });
  });

  group('Mobi H1: a doubt with no chapter always offers one to pick', () {
    testWidgets('a fresh account (no record) gets the subject\'s syllabus chapters', (tester) async {
      final picked = <(String, String)>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: DoubtChecks(
            thread: const DoubtThread(info: ThreadInfo(id: 't1'), openedAt: 1, askedSubject: 'accountancy'),
            onAnswer: (_, _) {},
            onChapter: (s, c) => picked.add((s, c)),
          ),
        ),
        overrides: [
          authSnapshotProvider.overrideWith(() => _Auth(['accountancy', 'economics'])),
          practiceChaptersProvider('accountancy').overrideWith(
            (ref) async => const ChapterCatalog(units: [
              ChapterUnit(id: 'u', name: 'u', chapters: [
                ChapterEntry(id: 'g', name: 'Goodwill: Nature and Valuation'),
                ChapterEntry(id: 'p', name: 'Partnership Fundamentals'),
              ]),
            ]),
          ),
        ],
      );
      await tester.pumpAndSettle();
      expect(find.text(DoubtCopy.pickChapter), findsOneWidget);
      await tester.tap(find.text('Goodwill: Nature and Valuation'));
      expect(picked, [('accountancy', 'Goodwill: Nature and Valuation')]);
    });

    testWidgets('no subject either: the student\'s subjects first, then that subject\'s chapters', (tester) async {
      final picked = <(String, String)>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: DoubtChecks(
            thread: const DoubtThread(
              info: ThreadInfo(id: 't1'),
              openedAt: 1,
              checksNote: 'Pick the chapter and Mobi adds 2 real CUET questions on it to test this.',
            ),
            onAnswer: (_, _) {},
            onChapter: (s, c) => picked.add((s, c)),
          ),
        ),
        overrides: [
          authSnapshotProvider.overrideWith(() => _Auth(['accountancy', 'economics'])),
          practiceChaptersProvider('economics').overrideWith(
            (ref) async => const ChapterCatalog(units: [
              ChapterUnit(id: 'u', name: 'u', chapters: [ChapterEntry(id: 'm', name: 'Money and Banking')]),
            ]),
          ),
        ],
      );
      await tester.pumpAndSettle();
      expect(find.text(DoubtCopy.pickSubject), findsOneWidget);
      expect(find.textContaining('real CUET'), findsNothing);
      await tester.tap(find.text('Economics'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Money and Banking'));
      expect(picked, [('economics', 'Money and Banking')]);
    });
  });
}
