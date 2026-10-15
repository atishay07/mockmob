import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/rules/data/rules_data.dart';
import 'package:mockmob/features/rules/screens/rule_book_screen.dart';

import '../../golden/review/review_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/review_fixtures.dart';

/// The Use key (its face keeps a second copy of the label to hold its width, so find the key itself).
final useKey = find.byWidgetPredicate((w) => w is KeyButton && w.label == 'Use in my next mock');

Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

RulesRead rulesRead({Map<String, dynamic>? book}) =>
    RulesRead.parse({'book': book ?? contract('rules')['book'], 'acrossMocks': contract('across')});

/// "Use in my next mock" as the server answers it: a held answer the test releases, or a refusal.
class FakePlaybookApi implements PlaybookApi {
  final List<String> uses = [];
  Completer<RuleRef>? pending;
  Object? failWith;

  @override
  Future<RuleRef> use(String ruleId) {
    uses.add(ruleId);
    if (failWith != null) return Future.error(failWith!);
    pending = Completer<RuleRef>();
    return pending!.future;
  }

  @override
  Future<PlaybookRead> read({String? subject}) async => PlaybookRead.fromJson(contract('rules')['playbook']);
}

class RecordingHaptics implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');
}

/// The Rule book (Mistake Lab v4 slice 3, spec 4.10): both kinds of rule in the server's words,
/// one rule's actions open at a time, "Use in my next mock" moves the rule only on the server's
/// yes (with the confirm haptic), a refusal changes nothing, and Copy copies.
/// Motion is off in these tests, so a few frames settle every change (Mobi's room never loops).
Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(loadAppFonts);

  Future<(FakePlaybookApi, RecordingHaptics)> pump(WidgetTester tester, {RemoteState<RulesRead>? state, Size size = const Size(390, 2600)}) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final api = FakePlaybookApi();
    final haptics = RecordingHaptics();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          rulesRepositoryProvider.overrideWithBuild((ref, n) => state ?? RemoteState(value: rulesRead(), fetchedAt: DateTime.utc(2026, 10, 15, 9))),
          playbookApiProvider.overrideWithValue(api),
          hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics)),
        ],
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
            home: const RuleBookScreen(),
          ),
        ),
      ),
    );
    await settle(tester);
    return (api, haptics);
  }

  testWidgets('both kinds of rule, the rule in force lit at the top, the basis', (tester) async {
    await pump(tester);
    final book = RuleBook.tryParse(contract('rules')['book'])!;
    expect(find.text('Your rules'), findsOneWidget);
    expect(find.text('From your repairs'), findsOneWidget);
    expect(find.text('From how you take papers'), findsOneWidget);
    for (final c in book.repairs.chapters) {
      expect(find.text(c.chapter), findsOneWidget);
    }
    for (final h in book.habits.rules) {
      expect(find.text(h.evidence), findsOneWidget);
    }
    expect(find.text('To remember it: Arrears are owed to you, not paid.'), findsOneWidget);
    // The rule in force: in the lit card and tagged in its row.
    expect(find.text('Open every question once before you go deep on any.'), findsNWidgets(2));
    expect(find.text('Your rule for your next mock'), findsNWidgets(2));
    expect(find.text(book.basis!), findsOneWidget);
    // Repairs come first, then the habits.
    expect(tester.getTopLeft(find.text('From your repairs')).dy < tester.getTopLeft(find.text('From how you take papers')).dy, isTrue);
  });

  testWidgets('one rule\'s actions at a time; the rule in force has Copy only', (tester) async {
    await pump(tester);
    expect(useKey, findsNothing);
    await tester.tap(find.text('Calls in arrears are deducted from called-up capital, never added.'));
    await settle(tester);
    expect(useKey, findsOneWidget);
    expect(find.text('Copy'), findsOneWidget);
    await tester.tap(find.text('Answer the questions you mark for review.'));
    await settle(tester);
    expect(useKey, findsOneWidget, reason: 'the first row closed as the second opened');
    // The rule in force: nothing to use, only Copy.
    await tester.tap(find.text('Open every question once before you go deep on any.').last);
    await settle(tester);
    expect(useKey, findsNothing);
    expect(find.text('Copy'), findsOneWidget);
  });

  testWidgets('Use in my next mock: nothing moves until the server says yes, then the rule is in force', (tester) async {
    final (api, haptics) = await pump(tester);
    const rule = 'Calls in arrears are deducted from called-up capital, never added.';
    await tester.tap(find.text(rule));
    await settle(tester);
    await tester.tap(useKey);
    await tester.pump();
    expect(api.uses, ['repair:6864871273367fbf6b15b814']);
    // Waiting: the old rule is still the one in force, and no confirm has been felt.
    expect(find.text('Your rule for your next mock'), findsNWidgets(2));
    expect(find.text('Open every question once before you go deep on any.'), findsNWidgets(2));
    expect(haptics.calls.contains('medium'), isFalse);

    api.pending!.complete(const RuleRef(id: 'repair:6864871273367fbf6b15b814', kind: RuleRef.repair, text: rule));
    await settle(tester);
    // Confirmed: the confirm haptic (medium then light without the Android verb), the lit card and
    // the tag moved to the chosen rule, and the old one is a plain rule again.
    expect(haptics.calls, containsAllInOrder(['medium', 'light']));
    expect(find.text(rule), findsNWidgets(2));
    expect(find.text('Open every question once before you go deep on any.'), findsOneWidget);
    expect(find.text('Your rule for your next mock'), findsNWidgets(2));
    expect(useKey, findsNothing, reason: 'the row closed on the confirm');
  });

  testWidgets('a refusal changes nothing and says so in the row', (tester) async {
    final (api, haptics) = await pump(tester);
    api.failWith = const ApiError(kind: ApiErrorKind.validation, code: 'invalid_request', status: 422);
    await tester.tap(find.text('Answer the questions you mark for review.'));
    await settle(tester);
    await tester.tap(useKey);
    await settle(tester);
    expect(find.text('That rule is not in your Rule book right now. Your rules have been read again.'), findsOneWidget);
    expect(find.text('Open every question once before you go deep on any.'), findsNWidgets(2));
    expect(haptics.calls.contains('medium'), isFalse);

    api.failWith = const ApiError(kind: ApiErrorKind.network, code: 'network');
    await tester.tap(useKey);
    await settle(tester);
    expect(find.text("You're offline, so your rule was not changed."), findsOneWidget);
  });

  testWidgets('Copy puts the rule and its hook on the clipboard and says Copied', (tester) async {
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await pump(tester);
    await tester.tap(find.text('Calls in arrears are deducted from called-up capital, never added.'));
    await settle(tester);
    await tester.tap(find.text('Copy'));
    await tester.pump();
    expect(copied, 'Calls in arrears are deducted from called-up capital, never added.\nTo remember it: Arrears are owed to you, not paid.');
    expect(find.text('Copied'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Copy'), findsOneWidget);
  });

  testWidgets('below the habits gate, with no repairs yet: the server\'s two sentences', (tester) async {
    final book = {
      ...contract('rules')['book'] as Map<String, dynamic>,
      'count': 0,
      'countLabel': 'Your rules, 0',
      'active': null,
      'repairs': {'empty': 'Your first repair adds a rule here.', 'chapters': []},
      'habits': {'state': 'below_gate', 'gateLine': 'Rules from how you take papers need 3 timed mocks. You have 1 of 3.', 'rules': []},
    };
    await pump(tester, state: RemoteState(value: rulesRead(book: book), fetchedAt: DateTime.utc(2026, 10, 15, 9)));
    expect(find.text('Your first repair adds a rule here.'), findsOneWidget);
    expect(find.text('Rules from how you take papers need 3 timed mocks. You have 1 of 3.'), findsOneWidget);
    expect(find.text('Your rule for your next mock'), findsNothing);
  });

  testWidgets('a failed first read offers Try again; a cached book shows with the offline line', (tester) async {
    await pump(tester, state: const RemoteState(error: ApiError(kind: ApiErrorKind.server, code: 'server_error', status: 503)));
    expect(find.text('Your rules could not be loaded.'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);

    // A fresh scope, so the second state is the one read (the first scope would keep its own).
    await tester.pumpWidget(const SizedBox());
    await pump(
      tester,
      state: RemoteState(value: rulesRead(), fetchedAt: DateTime.utc(2026, 10, 15, 9), error: const ApiError(kind: ApiErrorKind.network, code: 'network')),
    );
    expect(find.text('Offline. Showing last loaded rules.'), findsOneWidget);
    expect(find.text('From your repairs'), findsOneWidget);
  });

  testWidgets('Review lists the Rule book under the record and the saved questions', (tester) async {
    await pumpMockmob(
      tester,
      const ReviewScreen(),
      size: const Size(384, 2400),
      disableAnimations: true,
      wrapInScaffold: false,
      overrides: reviewOverrides(records: [repairedRecord], rules: RemoteState(value: rulesRead(), fetchedAt: DateTime.utc(2026, 10, 15, 9))),
    );
    expect(find.text('Your rules, 7'), findsOneWidget);
    expect(find.text('Next mock: Open every question once before you go deep on any.'), findsOneWidget);
  });
}
