import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/student_actions.dart';
import '../../../core/storage/prefs_store.dart';
import '../../billing/billing.dart' show playBillingUserIdProvider;
import '../../credits/data/credit_figures.dart' show creditFiguresProvider;
import '../../billing/widgets/get_pro_entry.dart' show getProAvailableProvider;
import '../copy.dart';
import 'nudge_rules.dart';
import 'pro_nudge_store.dart';

/// The phone's preferences, where the nudges remember what they showed. Replaceable in tests.
final proNudgePrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

final proNudgeStoreProvider = Provider<ProNudgeStore>((ref) => ProNudgeStore(ref.watch(proNudgePrefsProvider)));

/// Names this run of the app. A new one every cold start; the first usage session after onboarding is
/// the run in which onboarding finished (the website's browser session). Replaceable in tests.
final proNudgeLaunchProvider = Provider<String>((ref) => DateTime.now().microsecondsSinceEpoch.toString());

/// Whether the Pro nudges exist for this student at all: `PLAY_BILLING` on, signed in, not Pro.
/// With the flag off every nudge, the pop-up and the Upgrade sheet draw nothing and the app is as it was.
final proNudgesOnProvider = Provider<bool>((ref) => ref.watch(getProAvailableProvider));

/// The student is in onboarding now: signed out (welcome, onboarding and sign-in are the signed-out
/// screens) or signed in with no subjects yet.
final proNudgeInOnboardingProvider = Provider<bool>((ref) {
  final auth = ref.watch(authSnapshotProvider);
  return auth.status == AuthStatus.signedOut || auth.needsOnboarding;
});

/// Whether the student has met a real limit: a Free student with [ArmRules.creditsLimit] practice credits
/// or fewer. False with the nudges off, for Pro, and while the figure is unknown or a stale copy. Overridden
/// in tests; it reads the credits only when the nudges are on, so with the flag off nothing is touched.
final proNudgeCreditsLowProvider = Provider<bool>((ref) {
  if (!ref.watch(proNudgesOnProvider)) return false;
  final f = ref.watch(creditFiguresProvider);
  if (f.isPro || f.loading || f.failed || f.stale) return false;
  return ArmRules.creditsMet(f.oneBalance ? f.total : f.practice);
});

class ProNudgeState {
  const ProNudgeState({
    this.userId,
    this.loaded = false,
    this.saved = const ProNudgeSaved(),
    this.armed = false,
    this.resultViewed = false,
    this.todayReturns = 0,
    this.away = false,
    this.viewedThisRun = const {},
  });

  final String? userId;

  /// What was saved on the phone has been read.
  final bool loaded;
  final ProNudgeSaved saved;

  /// This run: the first-session sheet was armed by the second return to Today since the first viewed
  /// result (D181). Not saved: the sheet belongs to the first session, which is one run. A real limit arms
  /// it too, read live ([proNudgeCreditsLowProvider]).
  final bool armed;

  /// This run: the student viewed a result, so returns to Today now count.
  final bool resultViewed;

  /// Returns to Today since the first result viewed in this run. Another result never starts it again.
  final int todayReturns;

  /// The student is on a page, or was on one and has not reached a tab root since: the next arrival at
  /// Today is a return ([ArmRules.step]). Kept here, not in the app shell, which a page opened with `go`
  /// takes away and builds again.
  final bool away;

  /// The attempts whose result was counted as viewed in this run: each is counted once.
  final Set<String> viewedThisRun;

  ProNudgeState copyWith({bool? loaded, ProNudgeSaved? saved, bool? armed, bool? resultViewed, int? todayReturns, bool? away, Set<String>? viewedThisRun}) => ProNudgeState(
        userId: userId,
        loaded: loaded ?? this.loaded,
        saved: saved ?? this.saved,
        armed: armed ?? this.armed,
        resultViewed: resultViewed ?? this.resultViewed,
        todayReturns: todayReturns ?? this.todayReturns,
        away: away ?? this.away,
        viewedThisRun: viewedThisRun ?? this.viewedThisRun,
      );
}

/// What the Pro nudges know: what was shown and dismissed (saved on the phone), and when onboarding
/// finished (the start of the first usage session). The rules themselves are in `nudge_rules.dart`.
class ProNudgeController extends Notifier<ProNudgeState> {
  @override
  ProNudgeState build() {
    final userId = ref.watch(playBillingUserIdProvider);
    // Either can be what completes the picture (out of onboarding, onboarding sealed); the mark is
    // decided from the state, never from the order they arrive in.
    ref.listen<bool>(proNudgeInOnboardingProvider, (_, _) => _noteOnboarded());
    ref.listen<bool>(onboardedThisRunProvider, (_, _) => _noteOnboarded());
    if (userId != null) unawaited(Future<void>.microtask(() => _load(userId)));
    return ProNudgeState(userId: userId);
  }

  Future<void> _load(String userId) async {
    final ProNudgeSaved saved;
    try {
      saved = await ref.read(proNudgeStoreProvider).load(userId);
    } on Object {
      // The phone's preferences cannot be read: nothing is known, so no nudge shows (they wait for `loaded`).
      return;
    }
    if (!ref.mounted || state.userId != userId) return;
    // What happened while the read was in flight (a Pro page opened, a result viewed) is kept, never replaced
    // by the older copy that was read.
    final now = state.saved;
    state = state.copyWith(
      loaded: true,
      saved: saved.copyWith(
        popupShown: saved.popupShown || now.popupShown,
        resultsViewed: saved.resultsViewed > now.resultsViewed ? saved.resultsViewed : now.resultsViewed,
        firstResultId: saved.firstResultId ?? now.firstResultId,
      ),
    );
    _noteOnboarded();
  }

  /// Saves one thing on the phone. Best effort, as everything here: a value that cannot be saved only means a
  /// nudge may show once more, and a student's tap never waits for, or fails with, the phone's storage.
  void _persist(Future<void> Function(ProNudgeStore store) write) {
    try {
      unawaited(write(ref.read(proNudgeStoreProvider)).catchError((Object _) {}));
    } on Object {
      // See above.
    }
  }

  /// Onboarding finished in this run and the student is signed in and out of onboarding: the first
  /// usage session starts now (once; see [PopupRules.noteOnboarded]).
  void _noteOnboarded() {
    final userId = state.userId;
    if (userId == null || !state.loaded) return;
    // As on the website, the mark does not wait for the plan read: a Free student whose plan arrives a
    // moment later still has this as the start of the first session (the verdict checks Pro and the flag).
    if (!ref.read(onboardedThisRunProvider) || ref.read(proNudgeInOnboardingProvider)) return;
    final saved = state.saved;
    final mark = PopupRules.noteOnboarded(
      onboardedAt: saved.onboardedAt,
      shown: saved.popupShown,
      now: ref.read(nowProvider)(),
      launchId: ref.read(proNudgeLaunchProvider),
      actions: ref.read(studentActionsProvider),
    );
    if (mark == null) return;
    state = state.copyWith(saved: saved.copyWith(onboardedAt: mark.at, onboardedLaunch: mark.launch, actionsAtOnboarded: mark.actions));
    _persist((store) => store.saveOnboarded(userId, at: mark.at, launch: mark.launch, actions: mark.actions));
  }

  /// The student is looking at the result for [attemptId]: the result's Pro row is on the page on top (a
  /// result built under the sealed sheet is not looked at yet). Counted once per attempt in a run. A new
  /// student's first result is saved by its attempt, so that one result stays free of a Pro ask however
  /// often it is opened (D181), and from the first one on, returns to Today count towards arming the
  /// first-session sheet. A later result never starts that count again.
  void noteResultViewed(String attemptId) {
    final userId = state.userId;
    if (userId == null || !state.loaded || state.viewedThisRun.contains(attemptId)) return;
    final saved = state.saved;
    final claimsFirst = saved.firstResultId == null && ArmRules.firstResult(onboardedAt: saved.onboardedAt, resultsViewed: saved.resultsViewed, firstResultId: null, attemptId: attemptId);
    final count = saved.resultsViewed + 1;
    state = state.copyWith(
      saved: saved.copyWith(resultsViewed: count, firstResultId: claimsFirst ? attemptId : null),
      resultViewed: true,
      viewedThisRun: {...state.viewedThisRun, attemptId},
    );
    _persist((store) => store.saveResultsViewed(userId, count));
    if (claimsFirst) _persist((store) => store.saveFirstResult(userId, attemptId));
  }

  /// The router's top location changed to [place] (the router reports every change). After a viewed
  /// result, the [ArmRules.returnsToArm]th arrival at Today from a page arms the first-session sheet. A
  /// sheet opened and closed, and a switch of tab, are not returns ([ArmRules.step]).
  void notePlace(ShellPlace place) {
    final move = ArmRules.step(away: state.away, to: place);
    if (move.away == state.away && !move.returned) return;
    if (!move.returned || state.userId == null || !state.resultViewed || state.armed) {
      state = state.copyWith(away: move.away);
      return;
    }
    final returns = state.todayReturns + 1;
    state = state.copyWith(away: move.away, todayReturns: returns, armed: returns >= ArmRules.returnsToArm);
  }

  /// The student opened the full Pro page themselves (a locked mode, a Pro-only part). That was the Pro ask,
  /// made at the moment they chose it, so the first-session sheet never follows it.
  void upgradeOpened() => popupShown();

  /// The first-session pop-up's moment: checks the rules again with the clock as it is now and, when
  /// it is due, marks it shown (saved on the phone, never shown again for this account) and returns
  /// true. Marked before it opens, so a second call in the same moment finds it shown.
  bool takePopup() {
    if (PopupRules.verdict(_inputs(ref, state, watch: false)) != PopupVerdict.due) return false;
    popupShown();
    return true;
  }

  /// The first-session pop-up is being shown: it is never shown again, on this phone, for this account.
  void popupShown() {
    final userId = state.userId;
    if (userId == null || state.saved.popupShown) return;
    state = state.copyWith(saved: state.saved.copyWith(popupShown: true));
    _persist((store) => store.savePopupShown(userId));
  }

  /// The student closed an inline nudge: it stays quiet for [InlineRules.quietFor].
  void dismiss(ProNudgeSurface surface) {
    final userId = state.userId;
    if (userId == null) return;
    final at = ref.read(nowProvider)();
    state = state.copyWith(saved: state.saved.copyWith(dismissed: {...state.saved.dismissed, surface.key: at}));
    _persist((store) => store.saveDismissed(userId, surface, at));
  }
}

/// The pop-up's inputs: [watch] in the provider (so it follows every change), read at the moment of showing.
PopupInputs _inputs(Ref ref, ProNudgeState s, {required bool watch}) {
  T get<T>(ProviderListenable<T> p) => watch ? ref.watch(p) : ref.read(p);
  return PopupInputs(
    enabled: get(proNudgesOnProvider),
    loaded: s.loaded,
    shown: s.saved.popupShown,
    inOnboarding: get(proNudgeInOnboardingProvider),
    launchId: get(proNudgeLaunchProvider),
    now: get(nowProvider)(),
    onboardedAt: s.saved.onboardedAt,
    onboardedLaunch: s.saved.onboardedLaunch,
    actions: get(studentActionsProvider),
    actionsAtOnboarded: s.saved.actionsAtOnboarded,
    armed: s.armed || get(proNudgeCreditsLowProvider),
  );
}

final proNudgeProvider = NotifierProvider<ProNudgeController, ProNudgeState>(ProNudgeController.new);

/// Whether the inline nudge for [surface] may show now. Never for a Pro student, never with the flag
/// off, and not for [InlineRules.quietFor] after it was dismissed.
final proNudgeVisibleProvider = Provider.family<bool, ProNudgeSurface>((ref, surface) {
  final enabled = ref.watch(proNudgesOnProvider);
  final s = ref.watch(proNudgeProvider);
  return InlineRules.visible(enabled: enabled, loaded: s.loaded, now: ref.watch(nowProvider)(), dismissedAt: s.saved.dismissed[surface.key]);
});

/// Why the first-session pop-up is or is not due. See [PopupRules.verdict]. The clock is read when a
/// dependency changes; [ProNudgeController.takePopup] reads it again at the moment of showing.
final upgradePopupVerdictProvider = Provider<PopupVerdict>((ref) => PopupRules.verdict(_inputs(ref, ref.watch(proNudgeProvider), watch: true)));

/// True while the first-session pop-up is due and has not been shown. The app shell shows it, once
/// the student is back on a calm screen, and calls [ProNudgeController.popupShown].
final upgradePopupDueProvider = Provider<bool>((ref) => ref.watch(upgradePopupVerdictProvider) == PopupVerdict.due);
