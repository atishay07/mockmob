// The chapter list groups chapters under unit headers only where a unit really groups something.
// A unit that holds one chapter with the same name ("Business Environment" over "Business
// Environment") gets no header, and one multi-chapter unit does not bring the repeated headers
// back for the others (v14, ledger F8).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/widgets/chapter_picker.dart';

import '../../helpers/fonts.dart';

ChapterUnit _unit(String name, List<String> chapters) =>
    ChapterUnit(id: name, name: name, chapters: [for (final c in chapters) ChapterEntry(id: c, name: c)]);

Future<void> _pump(WidgetTester tester, List<ChapterUnit> units, {String query = ''}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(Brightness.dark),
      home: Scaffold(
        body: SingleChildScrollView(
          child: ChapterUnitsList(units: units, query: query, chosen: const [], full: false, onToggle: (_) {}),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('a unit that only repeats its one chapter has no header, even beside a real group', (tester) async {
    await _pump(tester, [
      _unit('Nature and Significance of Management', ['Nature & Significance of Management']),
      _unit('Principles of Management', ['Principles of Management']),
      _unit('Financial Management', ['Capital Structure', 'Financial Markets', 'Working Capital']),
      _unit('Business Environment', ['Business Environment']),
    ]);
    // Each repeated name shows once (the chapter row), never twice (header and row).
    expect(find.text('Principles of Management'), findsOneWidget);
    expect(find.text('Business Environment'), findsOneWidget);
    expect(find.text('Nature and Significance of Management'), findsNothing);
    expect(find.text('Nature & Significance of Management'), findsOneWidget);
    // The real group keeps its header and its three chapters.
    expect(find.text('Financial Management'), findsOneWidget);
    expect(find.text('Capital Structure'), findsOneWidget);
    expect(find.text('Financial Markets'), findsOneWidget);
  });

  testWidgets('a one-chapter unit with a different name keeps its header', (tester) async {
    await _pump(tester, [_unit('Marketing', ['Branding'])]);
    expect(find.text('Marketing'), findsOneWidget);
    expect(find.text('Branding'), findsOneWidget);
  });
}
