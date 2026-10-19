import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/repositories/plan_repository.dart';
import '../copy.dart';
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'open_paper.dart';
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
  const LaunchNeedsLook(this.quote, {required this.costChanged, this.message});

  final PracticeQuote quote;
  final bool costChanged;

  /// The server's own sentence, when the look is needed because the free first full mock was taken
  /// since the quote the student saw (FIRST_FULL_MOCK_TAKEN). Shown in place of the stock "changed" line.
  final String? message;
}

class LaunchFailed extends LaunchResult {
  const LaunchFailed(this.failure, {this.message});

  final StartFailure failure;
  final String? message;
}

/// A paper is open, so nothing was charged for another: the student continues that one first (v15 walk,
/// credits). Only a start that would take credits waits; a free one never does.
class LaunchOpenPaper extends LaunchResult {
  const LaunchOpenPaper(this.paper);

  final OpenPaper paper;
}

/// True when starting on [quote] would take credits (not free by allowance, not Pro access).
bool quoteSpendsCredits(PracticeQuote quote) => !quote.freeByAllowance && (quote.creditCost ?? 0) > 0;

/// True when [fresh] asks the student to pay more than [shown] did.
bool costWentUp(PracticeQuote shown, PracticeQuote fresh) {
  return effectiveCreditCost(fresh) > effectiveCreditCost(shown);
}

/// What [quote] asks the student to pay, as the check below reads it: nothing when an allowance covers it.
int effectiveCreditCost(PracticeQuote quote) => quote.freeByAllowance ? 0 : (quote.creditCost ?? 0);

/// True when the quote the student saw was for another length than the one being started. A practice set costs a
/// credit a question, so a figure shown for 5 questions says nothing about 20: such a quote is never launched on.
bool quoteIsForOtherCount(PracticeQuote shown, PracticeSelection selection) => shown.count != null && shown.count != selection.effectiveCount;

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
  final otherCount = quoteIsForOtherCount(shown, selection);
  if (otherCount || quote.isExpiredAt(ref.read(nowProvider)())) {
    try {
      quote = await requote(ref, selection.quoteQuery);
    } on ApiError catch (e) {
      return LaunchFailed(failureFor(e));
    }
    if (!quote.launchable) return LaunchNeedsLook(quote, costChanged: false);
    // A figure the student saw for another length is not one they agreed to: any difference is shown again, not only a
    // dearer one.
    final changed = otherCount ? effectiveCreditCost(quote) != effectiveCreditCost(shown) : costWentUp(shown, quote);
    if (changed) return LaunchNeedsLook(quote, costChanged: true);
  }
  if (!quote.launchable) return LaunchNeedsLook(quote, costChanged: false);

  // Never a second paid paper while one is open: the open one is continued, so nothing is charged twice.
  if (quoteSpendsCredits(quote)) {
    final open = await _openPaper(ref);
    if (open != null) return LaunchOpenPaper(open);
  }

  int? mockNumber;
  if (selection.mode.isMock) {
    final catalog = ref.read(practiceSubjectsProvider).value;
    final internal = internalSubjectFor(selection.subjectId, catalog);
    final completed = await ref.read(completedMockCountProvider(internal).future).catchError((_) => null);
    mockNumber = completed == null ? null : completed + 1;
  }

  final outcome = await ref.read(practiceStarterProvider).start(selection, quote: quote, mockNumber: mockNumber);
  // The free first full mock was started elsewhere between the quote and this start: nothing was charged and the
  // key is forgotten. A new quote is read now, so the price the student must now pay is on screen before they can
  // start again, never the "Free" they saw.
  if (outcome case StartFailed(failure: StartFailure.firstMockTaken, :final message)) {
    try {
      final fresh = await requote(ref, selection.quoteQuery);
      return LaunchNeedsLook(fresh, costChanged: true, message: message ?? PracticeCopy.firstMockTaken);
    } on Object {
      // No new price could be read: the sentence still says nothing was charged and to check the price.
      return LaunchFailed(StartFailure.firstMockTaken, message: message);
    }
  }
  return _resultOf(ref, outcome);
}

/// The paper a credit-spending start must wait for, or null. A read that fails never stops a start: the
/// guard only adds a stop, it never takes one away.
Future<OpenPaper?> _openPaper(WidgetRef ref) async {
  try {
    final held = heldHintOf(ref.read(planRepositoryProvider(openPaperPlanMinutes)).value);
    return await ref.read(openPaperResolverProvider).blocker(held);
  } on Object {
    return null;
  }
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
