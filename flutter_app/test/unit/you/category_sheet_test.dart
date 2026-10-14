// The category row and the category sheet say the words ("Unreserved", "Sikh minority"), never the
// portal codes, and the stored value stays the code. The college rows say what the figure is.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/you/sheet/sheet_editor_screen.dart';
import 'package:mockmob/features/you/subjects/subject_rows.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

const _user = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'asha.verma@example.com',
  name: 'Asha Verma',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

Future<void> _pump(WidgetTester tester) => pumpMockmob(
      tester,
      const SheetEditorScreen(),
      wrapInScaffold: false,
      disableAnimations: true,
      size: const Size(384, 1400),
      overrides: youOverrides(fakeAuth: FakeAuth(_user)),
    );

void main() {
  testWidgets('the Category row shows the word, and the sheet lists words with the code kept underneath', (tester) async {
    await _pump(tester);
    expect(find.text('Unreserved'), findsOneWidget);
    expect(find.text('UR'), findsNothing);

    await tester.ensureVisible(find.text('Unreserved'));
    await tester.pump();
    await tester.tap(find.text('Unreserved'));
    await tester.pumpAndSettle();

    for (final word in ['Unreserved', 'OBC', 'SC', 'ST', 'EWS', 'Sikh minority', 'PwBD', 'Kashmiri migrant', 'Single girl child', 'Orphan (female)', 'Orphan (male)']) {
      expect(find.text(word), findsWidgets, reason: word);
    }
    for (final code in ['OBC-NCL', 'SIKH', 'KM', 'SGC', 'ORPHAN-FEMALE', 'ORPHAN-MALE']) {
      expect(find.text(code), findsNothing, reason: code);
    }
  });

  testWidgets('a subject practice cannot open gets its own emblem, or a plain book when the art has none', (tester) async {
    await pumpMockmob(
      tester,
      const Material(
        child: Column(
          children: [
            StaleSubjectRow(id: 'accountancy', name: 'Accountancy', reason: null, onRemove: null),
            StaleSubjectRow(id: 'not_a_subject', name: 'Other', reason: null, onRemove: null),
          ],
        ),
      ),
      wrapInScaffold: false,
      disableAnimations: true,
      size: const Size(384, 400),
    );
    expect(find.byType(SubjectEmblem), findsOneWidget);
    expect(find.byIcon(LucideIcons.bookOpen), findsOneWidget);
  });
}
