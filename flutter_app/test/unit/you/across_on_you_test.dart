import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rules/copy.dart' show RulesCopy;
import 'package:mockmob/features/rules/widgets/across_mocks_view.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import 'you_test_support.dart';

Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// Across your mocks on You (Mistake Lab v4 slice 3, spec 4.9): the same block as the Lab's end,
/// from `GET /api/me/rules`, between Progress and Settings. Nothing while there is nothing to read.
void main() {
  setUp(AcrossMocksView.debugResetSeen);

  Future<void> pump(WidgetTester tester, RemoteState<RulesRead> rules) async {
    await pumpMockmob(
      tester,
      const YouHubScreen(),
      disableAnimations: true,
      wrapInScaffold: false,
      size: const Size(384, 7000),
      overrides: youOverrides(rules: rules),
    );
    await tester.pump();
  }

  testWidgets('the block with its server sentences, under Personal bests and above My subjects', (tester) async {
    final read = RulesRead.parse({'book': contract('rules')['book'], 'acrossMocks': contract('across')});
    await pump(tester, RemoteState(value: read, fetchedAt: DateTime.utc(2026, 10, 15, 9)));
    expect(find.text('Across your mocks'), findsOneWidget);
    for (final line in read.acrossMocks!.lines) {
      expect(find.text(RulesCopy.neverOpenedLine(line.text)), findsOneWidget);
    }
    expect(find.text('Show all 5'), findsOneWidget);
    final across = tester.getTopLeft(find.text('Across your mocks')).dy;
    expect(across < tester.getTopLeft(find.text('My subjects')).dy, isTrue);
  });

  testWidgets('before the first recorded mock: the server\'s one sentence', (tester) async {
    const none = 'Across your mocks starts with your first Full or NTA mock that your device records.';
    final read = RulesRead.parse({
      'book': contract('rules')['book'],
      'acrossMocks': {'version': 1, 'state': 'none', 'title': 'Across your mocks', 'mocks': 0, 'message': none, 'lines': [], 'more': []},
    });
    await pump(tester, RemoteState(value: read, fetchedAt: DateTime.utc(2026, 10, 15, 9)));
    expect(find.text(none), findsOneWidget);
  });

  testWidgets('signed out or not read: no block; a failed read: one quiet line with Try again', (tester) async {
    await pump(tester, const RemoteState());
    expect(find.text('Across your mocks'), findsNothing);

    // A fresh scope, so the second state is the one read (the first scope would keep its own).
    await tester.pumpWidget(const SizedBox());
    await pump(tester, const RemoteState(error: ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 503)));
    expect(find.text('Your record across mocks could not be loaded.'), findsOneWidget);
  });
}
