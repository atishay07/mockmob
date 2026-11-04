// LK94 (owner, 5 Nov 2026): Learn's part choice reads plainly once a choice is saved (at the onboarding, in You, or here): the
// line above the pills says which ("Part 2 has two options. Yours is Computerised Accounting."), not "Pick the one..." and no
// "Showing ... until you pick." limbo. With nothing chosen it asks as before (the web's words, parity-tested elsewhere).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/learn2/home/home_model.dart';

import 'home_support.dart';

LearnPart _part({String title = 'Part 2, Company Accounts and Analysis of Financial Statements', int choices = 2}) => LearnPart(
      id: 'p2',
      title: title,
      option: LearnPartOption(
        label: 'Your part',
        choices: [
          const LearnChoice('AFS', 'Analysis of Financial Statements'),
          const LearnChoice('CAS', 'Computerised Accounting'),
          if (choices > 2) const LearnChoice('X', 'Another part'),
        ],
      ),
    );

Finder _text(String s) => find.text(s, findRichText: true);

void main() {
  test('chosen, the line says which; with nothing chosen (or a choice the data does not name) it asks as before', () {
    expect(HomeModel.chosenOptionLine(_part(), 'CAS'), 'Part 2 has two options. Yours is Computerised Accounting.');
    expect(HomeModel.chosenOptionLine(_part(), 'AFS'), 'Part 2 has two options. Yours is Analysis of Financial Statements.');
    expect(HomeModel.chosenOptionLine(_part(title: 'Computerised', choices: 3), 'AFS', 0), 'Part 1 has three options. Yours is Analysis of Financial Statements.');
    for (final none in [null, '', 'ZZ']) {
      expect(HomeModel.chosenOptionLine(_part(), none), HomeModel.optionLine(_part()), reason: '$none');
    }
    expect(HomeModel.optionLine(_part()), 'Part 2 has two options. Pick the one your school teaches.', reason: "the web's words stay");
  });

  testWidgets('a part chosen before (the onboarding) reads settled: the line names it and nothing says "until you pick"', (tester) async {
    final api = HomeLearnApi(newStudent: true)..chosen['p2'] = 'AFS';
    await pumpHome(tester, overrides: homeOverrides(api));
    await settleHome(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('lh-switch-p2')));
    await tester.pump();
    expect(_text('Part 2 has two options. Yours is Analysis of Financial Statements.'), findsOneWidget);
    expect(_text('Part 2 has two options. Pick the one your school teaches.'), findsNothing);
    expect(_text('Showing Analysis of Financial Statements until you pick.'), findsNothing);
    expect(find.byKey(const ValueKey('lh-part-hint')), findsNothing, reason: 'no limbo line');
  });

  testWidgets('choosing here says which at once, while it saves, and stays once the server agrees', (tester) async {
    final api = HomeLearnApi(newStudent: true);
    final gate = Completer<void>();
    final keys = HomeKeyCards(api, gate: gate);
    await pumpHome(tester, overrides: homeOverrides(api, keyCards: keys), disableAnimations: false);
    await settleHome(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('lh-switch-p2')));
    await tester.pump(const Duration(milliseconds: 400));
    expect(_text('Part 2 has two options. Pick the one your school teaches.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('lh-choice-CAS')));
    await tester.pump();
    expect(_text('Part 2 has two options. Yours is Computerised Accounting.'), findsOneWidget);
    gate.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(_text('Part 2 has two options. Yours is Computerised Accounting.'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
  });
}
