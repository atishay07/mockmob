import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/router/routes.dart';
import 'mob_models.dart';
import 'mob_paper.dart';
import 'mob_repository.dart';

/// Where the Mob's actions lead, kept behind one seam so the page is testable and the hook into
/// the practice runner stays in one place.
abstract class MobNavigator {
  /// Starts or resumes this week's Mob paper (or one of the Mob's extra papers) and opens the
  /// runner. Null when it opened, else why not.
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob, {MobExtra? extra});

  void openAnswers(BuildContext context, String resultId);

  /// The repair for the shared trap (when the student picked it) or the reason it is wrong.
  void openTrap(BuildContext context, MobTrap trap, {String? resultId});

  /// Copies the invite link. True when it was copied.
  Future<bool> copyLink(String url);

  /// The system share sheet with the link text. True when it opened.
  Future<bool> shareLink(String text);
}

class DefaultMobNavigator implements MobNavigator {
  const DefaultMobNavigator();

  @override
  Future<MobFailure?> sitPaper(BuildContext context, WidgetRef ref, Mob mob, {MobExtra? extra}) async {
    final outcome = await ref.read(mobPaperLauncherProvider).start(mob, extra: extra);
    switch (outcome) {
      case MobPaperFailed(:final failure):
        // A paper that could not start may have changed the week (closed, already sat): read it again.
        if (failure == MobFailure.weekClosed || failure == MobFailure.alreadySat || failure == MobFailure.freePaperUsed || failure == MobFailure.extraClosed) {
          await ref.read(mobRepositoryProvider.notifier).refresh(force: true);
        }
        return failure;
      case MobPaperStarted(:final sessionId):
        if (!context.mounted) return null;
        context.go(AppRoutes.run(sessionId));
        return null;
    }
  }

  @override
  void openAnswers(BuildContext context, String resultId) => GoRouter.maybeOf(context)?.push(AppRoutes.practiceResult(resultId));

  @override
  void openTrap(BuildContext context, MobTrap trap, {String? resultId}) {
    final router = GoRouter.maybeOf(context);
    if (router == null) return;
    // The student's own result holds the repair of each question; without one, the mistakes list.
    router.push(resultId == null ? AppRoutes.reviewMistakes : AppRoutes.practiceResult(resultId));
  }

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
