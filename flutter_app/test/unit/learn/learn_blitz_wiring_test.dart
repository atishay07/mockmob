import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/learn/models/learn_catalog.dart';
import 'package:mockmob/features/learn/widgets/due_card.dart';
import 'package:mockmob/features/learn/widgets/lesson_list.dart';
import 'package:mockmob/features/learn/widgets/subject_mark.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/learn_fixtures.dart';

class _Counting implements HapticDriver {
  int selection = 0;

  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async => selection++;
}

void main() {
  setUpAll(loadAppFonts);

  group('the subject mark', () {
    testWidgets('a subject with a drawn emblem wears it, on its own light and in no tile', (tester) async {
      await pumpMockmob(tester, const Center(child: SubjectMark(subjectId: 'accountancy', name: 'Accountancy')), brightness: Brightness.dark, disableAnimations: true);
      final emblem = tester.widget<SubjectEmblem>(find.byType(SubjectEmblem));
      expect(emblem.subject, 'accountancy');
      expect(emblem.size, 56);
      expect(emblem.framed, isFalse);
      expect(find.byType(SubjectMonogram), findsNothing);
    });

    testWidgets('a language paper wears the shared language emblem', (tester) async {
      await pumpMockmob(tester, const Center(child: SubjectMark(subjectId: 'hindi', name: 'Hindi')), brightness: Brightness.dark, disableAnimations: true);
      expect(find.byType(SubjectEmblem), findsOneWidget);
    });

    testWidgets('a subject this build does not know gets its initials, never another subject object', (tester) async {
      await pumpMockmob(tester, const Center(child: SubjectMark(subjectId: 'film_studies', name: 'Film Studies')), brightness: Brightness.dark, disableAnimations: true);
      expect(find.byType(SubjectEmblem), findsNothing);
      expect(find.text('FS'), findsOneWidget);
    });
  });

  group('the lesson list', () {
    LearnUnit unit(String id, String title) => LearnUnit.fromJson(unitJson(id, title, 'new'));

    testWidgets('lessons are one grouped list, and a row opens its lesson with one tick', (tester) async {
      final haptics = _Counting();
      final opened = <String>[];
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: SubjectLessons(
            subject: const LearnSubject(id: 'accountancy', title: 'Accountancy'),
            units: [unit('u1', 'Sharing ratio'), unit('u2', 'Goodwill')],
            onOpen: (u) => opened.add(u.id),
            onReadChapter: (_) {},
          ),
        ),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      // The lessons share one group; the chapter summary is a second one.
      expect(find.byType(MmRowGroup), findsNWidgets(2));
      expect(find.byType(SubjectEmblem), findsOneWidget);
      await tester.tap(find.text('Goodwill'));
      await tester.pump();
      expect(opened, ['u2']);
      expect(haptics.selection, 1);
    });

    testWidgets('a row is still one spoken line: title, status word, length', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpMockmob(
        tester,
        SubjectLessons(subject: const LearnSubject(id: 'accountancy', title: 'Accountancy'), units: [unit('u1', 'Sharing ratio')], onOpen: (_) {}),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      expect(find.bySemanticsLabel('Sharing ratio. New. about 7 minutes'), findsOneWidget);
      handle.dispose();
    });
  });

  group('the due card', () {
    Widget card({required bool primary, int due = 12}) =>
        DueCard(queue: StudyQueueView(due: due, newReady: 0, pausedNew: false), recallEnabled: true, onStart: () {}, primary: primary);

    testWidgets('as the one action it is the lit hero, otherwise a plain card', (tester) async {
      await pumpMockmob(tester, card(primary: true), brightness: Brightness.dark, disableAnimations: true);
      expect(tester.widget<MmSurface>(find.byType(MmSurface)).tier, MmSurfaceTier.hero);
      expect(tester.widget<MmSurface>(find.byType(MmSurface)).lit, isTrue);
      await pumpMockmob(tester, card(primary: false), brightness: Brightness.dark, disableAnimations: true);
      expect(tester.widget<MmSurface>(find.byType(MmSurface)).tier, MmSurfaceTier.plain);
    });

    testWidgets('the count rolls in after the card and ticks once when it lands', (tester) async {
      final haptics = _Counting();
      await pumpMockmob(
        tester,
        card(primary: true),
        brightness: Brightness.dark,
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      await tester.pump(const Duration(milliseconds: 100));
      expect(haptics.selection, 0);
      await tester.pump(const Duration(seconds: 2));
      expect(haptics.selection, 1);
    });
  });
}
