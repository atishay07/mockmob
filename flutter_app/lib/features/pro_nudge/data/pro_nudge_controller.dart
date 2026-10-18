import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

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

/// Names this run of the app. A new one every cold start; it is what "the first session after
/// onboarding" is compared with. Replaceable in tests.
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

/// What the Pro nudges know: what was shown and dismissed (saved on the phone), and which run of the
/// app is the first after onboarding. The rules themselves are in `nudge_rules.dart`.
class ProNudgeController extends Notifier<ProNudgeState> {
  /// The student was seen in onboarding in this run.
  bool _sawOnboarding = false;

  @override
  ProNudgeState build() {
    final userId = ref.watch(playBillingUserIdProvider);
    if (ref.read(proNudgeInOnboardingProvider)) _sawOnboarding = true;
    ref.listen<bool>(proNudgeInOnboardingProvider, (_, now) {
      if (now) {
        _sawOnboarding = true;
      } else {
        // Out of onboarding: this run is the onboarding run, and is marked as such.
        _classify();
      }
    });
    // The nudges may come on later (the plan read says Free): the run is classified then.
    ref.listen<bool>(proNudgesOnProvider, (_, on) {
      if (on) _classify();
    });
    if (userId != null) unawaited(Future<void>.microtask(() => _load(userId)));
    return ProNudgeState(userId: userId);
  }

  Future<void> _load(String userId) async {
    final saved = await ref.read(proNudgeStoreProvider).load(userId);
    if (!ref.mounted || state.userId != userId) return;
    state = state.copyWith(loaded: true, saved: saved);
    _classify();
  }

  /// Marks which run is the onboarding run and which is the first after it. Waits until the nudges
  /// are on for this student and the student is out of onboarding.
  void _classify() {
    final userId = state.userId;
    if (userId == null || !state.loaded) return;
    if (!ref.read(proNudgesOnProvider) || ref.read(proNudgeInOnboardingProvider)) return;
    final saved = state.saved;
    final next = PopupRules.classify(
      launchId: ref.read(proNudgeLaunchProvider),
      sawOnboarding: _sawOnboarding,
      onboardedLaunch: saved.onboardedLaunch,
      firstSessionLaunch: saved.firstSessionLaunch,
    );
    if (next == null) return;
    state = state.copyWith(saved: saved.copyWith(onboardedLaunch: next.onboardedLaunch, firstSessionLaunch: next.firstSessionLaunch));
    unawaited(ref.read(proNudgeStoreProvider).saveLaunches(userId, onboardedLaunch: next.onboardedLaunch, firstSessionLaunch: next.firstSessionLaunch));
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

final proNudgeProvider = NotifierProvider<ProNudgeController, ProNudgeState>(ProNudgeController.new);

/// Whether the inline nudge for [surface] may show now. Never for a Pro student, never with the flag
/// off, and not for [InlineRules.quietFor] after it was dismissed.
final proNudgeVisibleProvider = Provider.family<bool, ProNudgeSurface>((ref, surface) {
  final enabled = ref.watch(proNudgesOnProvider);
  final s = ref.watch(proNudgeProvider);
  return InlineRules.visible(enabled: enabled, loaded: s.loaded, now: ref.watch(nowProvider)(), dismissedAt: s.saved.dismissed[surface.key]);
});

/// Why the first-session pop-up is or is not due. See [PopupRules.verdict].
final upgradePopupVerdictProvider = Provider<PopupVerdict>((ref) {
  final s = ref.watch(proNudgeProvider);
  return PopupRules.verdict(PopupInputs(
    enabled: ref.watch(proNudgesOnProvider),
    loaded: s.loaded,
    shown: s.saved.popupShown,
    inOnboarding: ref.watch(proNudgeInOnboardingProvider),
    launchId: ref.watch(proNudgeLaunchProvider),
    firstSessionLaunch: s.saved.firstSessionLaunch,
    actions: ref.watch(studentActionsProvider),
  ));
});

/// True while the first-session pop-up is due and has not been shown. The app shell shows it, once
/// the student is back on a calm screen, and calls [ProNudgeController.popupShown].
final upgradePopupDueProvider = Provider<bool>((ref) => ref.watch(upgradePopupVerdictProvider) == PopupVerdict.due);
