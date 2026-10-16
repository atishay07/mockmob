import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api.dart';
import '../../../core/router/routes.dart';
import 'mob_models.dart';
import 'mob_repository.dart';

/// Where the Mob's actions lead, kept behind one seam so the page is testable and the hook into
/// the practice runner stays in one place.
abstract class MobNavigator {
  /// Starts this week's Mob paper (`POST /api/mob/paper/start`) and opens the runner. Null when it
  /// opened, else why not.
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob);

  void openAnswers(BuildContext context, String resultId);

  /// The repair for the shared trap (when the student picked it) or the reason it is wrong.
  void openTrap(BuildContext context, MobTrap trap);

  /// Copies the invite link. True when it was copied.
  Future<bool> copyLink(String url);

  /// The system share sheet with the link text. True when it opened.
  Future<bool> shareLink(String text);
}

class DefaultMobNavigator implements MobNavigator {
  const DefaultMobNavigator();

  @override
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob) async {
    final override = ref.read(mobPaperStarterProvider);
    if (override != null) return override(context, ref, mob);
    // Without a runner hook the paper cannot open on this build: say so plainly rather than spend.
    return MobFailure.generic;
  }

  @override
  void openAnswers(BuildContext context, String resultId) => GoRouter.maybeOf(context)?.push(AppRoutes.result(resultId));

  @override
  void openTrap(BuildContext context, MobTrap trap) => GoRouter.maybeOf(context)?.push(AppRoutes.reviewMistakes);

  @override
  Future<bool> copyLink(String url) async {
    try {
      await Clipboard.setData(ClipboardData(text: url));
      return true;
    } on Object {
      return false;
    }
  }

  @override
  Future<bool> shareLink(String text) async {
    try {
      await SharePlus.instance.share(ShareParams(text: text));
      return true;
    } on Object {
      return false;
    }
  }
}

final mobNavigatorProvider = Provider<MobNavigator>((ref) => const DefaultMobNavigator());

/// The practice runner's hook for a Mob paper. Null until the practice area wires it (it owns
/// `practice_starter.dart`); the start route itself is [startMobPaperRequest].
typedef MobPaperStarter = Future<MobFailure?> Function(BuildContext context, WidgetRef ref, Mob mob);

final mobPaperStarterProvider = Provider<MobPaperStarter?>((ref) => null);

/// `POST /api/mob/paper/start`: the same body and reply as a practice start (`/api/sessions`).
Future<ApiResponse> startMobPaperRequest(ApiClient api, String generationKey) =>
    api.post('/api/mob/paper/start', body: {'generationKey': generationKey}, options: const ApiOptions(retries: 0, receiveTimeout: Duration(seconds: 60)));
