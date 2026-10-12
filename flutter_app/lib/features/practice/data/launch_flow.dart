import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
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
  const LaunchFailed(this.failure);

  final StartFailure failure;
}

class LaunchPendingElsewhere extends LaunchResult {
  const LaunchPendingElsewhere(this.sessionId);

  final String sessionId;
}

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
Future<LaunchResult> launchPractice(WidgetRef ref, PracticeSelection selection, PracticeQuote shown) async {
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
  return switch (outcome) {
    Started(:final sessionId) => LaunchStarted(sessionId),
    StartFailed(:final failure) => LaunchFailed(failure),
    StartPendingElsewhere(:final sessionId) => LaunchPendingElsewhere(sessionId),
  };
}

/// The cost line of a fresh quote, for "The cost changed" copy.
String costLineText(PracticeQuote quote) => costLineFor(quote).text ?? '';
