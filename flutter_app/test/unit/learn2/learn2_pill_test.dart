// C-LEARN-CALM (3 Nov): Learn's one pill family and the chapter shelf's kind icons.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/learn2/chapter/chapter_model.dart';
import 'package:mockmob/features/learn2/chapter/chapter_shelf.dart';
import 'package:mockmob/features/learn2/learn2_pill.dart';

Widget _wrap(Widget child, {Brightness brightness = Brightness.dark}) => MaterialApp(
      theme: buildTheme(brightness),
      home: Scaffold(body: Center(child: child)),
    );

void main() {
  testWidgets('a pill keeps every word: the label and its quieter trailing words', (tester) async {
    await tester.pumpWidget(_wrap(const LearnPill(label: 'Needs work', trailing: 'from your papers', tone: LearnPillTone.warn)));
    expect(find.text('Needs work, from your papers', findRichText: true), findsOneWidget);
  });

  testWidgets('a chosen pill carries a check, so the choice never rests on colour alone', (tester) async {
    await tester.pumpWidget(_wrap(const LearnPill(label: 'Computerised Accounting', tone: LearnPillTone.chosen)));
    expect(find.byIcon(LucideIcons.check), findsOneWidget);
    await tester.pumpWidget(_wrap(const LearnPill(label: 'Computerised Accounting', tone: LearnPillTone.choice)));
    expect(find.byIcon(LucideIcons.check), findsNothing);
  });

  testWidgets('a pill is at least 28 dp tall and grows when its words wrap', (tester) async {
    await tester.pumpWidget(_wrap(const SizedBox(width: 120, child: LearnPill(label: 'Analysis of Financial Statements'))));
    expect(tester.getSize(find.byType(LearnPill)).height, greaterThan(LearnPill.height));
    await tester.pumpWidget(_wrap(const LearnPill(label: 'Up next', tone: LearnPillTone.here), brightness: Brightness.light));
    expect(tester.getSize(find.byType(LearnPill)).height, greaterThanOrEqualTo(LearnPill.height));
  });

  test('every shelf row kind has its own icon', () {
    final icons = {for (final id in ['cards', 'questions', 'mistakes', 'lesson', 'print']) ShelfRow.iconFor(id)};
    expect(icons.length, 5);
  });

  testWidgets('a shelf row draws its kind icon and keeps its words', (tester) async {
    await tester.pumpWidget(_wrap(SizedBox(width: 360, child: ShelfRow(row: const ShelfRowModel(id: 'lesson', title: 'Lesson', line: 'Lesson · 7 min, not read yet'), onTap: () {}))));
    expect(find.byIcon(LucideIcons.bookOpen), findsOneWidget);
    expect(find.text('Lesson · 7 min, not read yet'), findsOneWidget);
  });
}
