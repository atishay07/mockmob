import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/practice_quote.dart';
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'practice_catalog.dart';
import 'practice_quote.dart';
import 'practice_starter.dart';

/// The result of trying to launch from a screen.
sealed class LaunchResult {
  const LaunchResult();
}

/// The session started: open the runner.
class LaunchStarted extends LaunchResult {
  const LaunchStarted(this.sessionId);

  final String sessionId;
}

/// The student must look again: the fresh quote differs from what they saw (it is now blocked
/// or costs more). Nothing was started or charged.
class LaunchNeedsLook extends LaunchResult {
  const LaunchNeedsLook(this.quote, {required this.costChanged});

  final PracticeQuote quote;
  final bool costChanged;
}

class LaunchFailed extends LaunchResult {
  const LaunchFailed(this.failure, {this.message});

  final StartFailure failure;
  final String? message;
}

/// True when starting on [quote] would take credits (not free by allowance, not Pro access).
bool quoteSpendsCredits(PracticeQuote quote) => !quote.freeByAllowance && (quote.creditCost ?? 0) > 0;

/// True when [fresh] asks the student to pay more than [shown] did.
bool costWentUp(PracticeQuote shown, PracticeQuote fresh) {
  final before = shown.freeByAllowance ? 0 : (shown.creditCost ?? 0);
  final after = fresh.freeByAllowance ? 0 : (fresh.creditCost ?? 0);
  return after > before;
}

/// The shared launch of spec 5.4: re-quote after expiry, never launch on a quote that is now
/// blocked or dearer than the one shown, look up the mock number, then start.
///
/// The Practice screens, the pre-start sheet and the auto-start route all call this, so the
/// rules live in one place.
///
/// It never throws: a revoked session, a database error or any other surprise comes back as
/// [LaunchFailed], so a Start key or the auto-start screen can always leave its busy state.
Future<LaunchResult> launchPractice(WidgetRef ref, PracticeSelection selection, PracticeQuote shown) async {
  try {
    return await _launchPractice(ref, selection, shown);
  } on Object {
    return const LaunchFailed(StartFailure.generic);
  }
}

Future<LaunchResult> _launchPractice(WidgetRef ref, PracticeSelection selection, PracticeQuote shown) async {
  var quote = shown;
  if (quote.isExpiredAt(ref.read(nowProvider)())) {
    try {
      quote = await requote(ref, selection.quoteQuery);
    } on ApiError catch (e) {
      return LaunchFailed(failureFor(e));
    }
    if (!quote.launchable) return LaunchNeedsLook(quote, costChanged: false);
    if (costWentUp(shown, quote)) return LaunchNeedsLook(quote, costChanged: true);
  }
  if (!quote.launchable) return LaunchNeedsLook(quote, costChanged: false);

  int? mockNumber;
  if (selection.mode.isMock) {
    final catalog = ref.read(practiceSubjectsProvider).value;
    final internal = internalSubjectFor(selection.subjectId, catalog);
    final completed = await ref.read(completedMockCountProvider(internal).future).catchError((_) => null);
    mockNumber = completed == null ? null : completed + 1;
  }

  final outcome = await ref.read(practiceStarterProvider).start(selection, quote: quote, mockNumber: mockNumber);
  return _resultOf(ref, outcome);
}

LaunchResult _resultOf(WidgetRef ref, StartOutcome outcome) {
  if (outcome case StartFailed(failure: StartFailure.generic)) _recheckCredits(ref);
  return switch (outcome) {
    Started(:final sessionId) => LaunchStarted(sessionId),
    StartFailed(:final failure, :final message) => LaunchFailed(failure, message: message),
  };
}

/// A start that failed with no definite answer may or may not have moved credits on the server.
/// The balance is read again, so the "we are checking" copy is true and You shows the result.
void _recheckCredits(WidgetRef ref) {
  try {
    unawaited(ref.read(authSnapshotProvider.notifier).reload().catchError((Object _) {}));
  } on Object {
    // The balance refreshes on the next app resume anyway.
  }
}

/// Starts a "5 fresh questions" check (WEB-PARITY A8). No quote: the server starts it free
/// and rechecks evidence, freshness and access itself.
Future<LaunchResult> launchFreshCheck(WidgetRef ref, PracticeSelection selection) async {
  try {
    final outcome = await ref.read(practiceStarterProvider).start(selection);
    return _resultOf(ref, outcome);
  } on Object {
    return const LaunchFailed(StartFailure.generic);
  }
}

/// The cost line of a fresh quote, for "The cost changed" copy.
String costLineText(PracticeQuote quote) => costLineFor(quote).text ?? '';
