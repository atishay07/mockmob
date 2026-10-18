import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/student_actions.dart';
import '../../../core/storage/prefs_store.dart';
import '../../billing/billing.dart' show playBillingUserIdProvider;
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

class ProNudgeState {
  const ProNudgeState({this.userId, this.loaded = false, this.saved = const ProNudgeSaved()});

  final String? userId;

  /// What was saved on the phone has been read.
  final bool loaded;
  final ProNudgeSaved saved;

  ProNudgeState copyWith({bool? loaded, ProNudgeSaved? saved}) => ProNudgeState(userId: userId, loaded: loaded ?? this.loaded, saved: saved ?? this.saved);
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
    final saved = await ref.read(proNudgeStoreProvider).load(userId);
    if (!ref.mounted || state.userId != userId) return;
    state = state.copyWith(loaded: true, saved: saved);
    _noteOnboarded();
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
    unawaited(ref.read(proNudgeStoreProvider).saveOnboarded(userId, at: mark.at, launch: mark.launch, actions: mark.actions));
  }

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
    unawaited(ref.read(proNudgeStoreProvider).savePopupShown(userId));
  }

  /// The student closed an inline nudge: it stays quiet for [InlineRules.quietFor].
  void dismiss(ProNudgeSurface surface) {
    final userId = state.userId;
    if (userId == null) return;
    final at = ref.read(nowProvider)();
    state = state.copyWith(saved: state.saved.copyWith(dismissed: {...state.saved.dismissed, surface.key: at}));
    unawaited(ref.read(proNudgeStoreProvider).saveDismissed(userId, surface, at));
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
