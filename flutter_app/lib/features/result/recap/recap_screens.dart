import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/result_providers.dart';
import '../result_nav.dart';
import 'recap_flow.dart';
import 'recap_room.dart';
import 'sheet_stage.dart';

/// `/result/:attemptId/sealed` (spec 5.6.2): the sheet arrives folded and sealed. There is no
/// waiting state: the attempt is already scored, so it is openable from the first frame. A
/// result opened before, or a student who chose "Open results directly", goes to the full result.
class SealedResultScreen extends ConsumerStatefulWidget {
  const SealedResultScreen({super.key, required this.attemptId});

  final String attemptId;

  @override
  ConsumerState<SealedResultScreen> createState() => _SealedResultScreenState();
}

class _SealedResultScreenState extends ConsumerState<SealedResultScreen> {
  bool _redirected = false;
  RecapRitual? _ritual;

  void _redirect() {
    if (_redirected) return;
    _redirected = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(resultActionsProvider).markSeen(widget.attemptId);
      ResultNav.toFullResult(context, widget.attemptId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final id = widget.attemptId;
    final data = ref.watch(recapDataProvider(id));
    // The ritual is read once: opening the sheet changes the stored values, and the screen must
    // not switch modes under the student's finger.
    _ritual ??= ref.watch(recapRitualProvider(id)).value;
    final ritual = _ritual;
    final model = data.model;
    if (model == null) {
      return RecapPlaceholder(data: data, attemptId: id, onRetry: () => retryRecapData(ref, id));
    }
    // The ritual (has it been opened before, does the student open directly) is a read of its own. Until
    // it answers the screen shows the sheet's skeleton, not a bare room: that read was the blank page
    // before the envelope art (v13 walk, finding 9).
    if (ritual == null) return RecapPlaceholder(data: data, attemptId: id, onRetry: () => retryRecapData(ref, id));
    if (_redirected) return RecapRoom(subjectId: model.subjectId, child: const SizedBox.expand());
    if (ritual.alreadyOpened || ritual.openDirectly || model.ordinal == null) {
      _redirect();
      return RecapRoom(subjectId: model.subjectId, child: const SizedBox.expand());
    }
    // The reveal rolls the figure, announces the marks and may spend the first-mock token, and the
    // server's tone and held questions come only with the detail read. Until that read has a
    // value or has failed, the sheet stays a skeleton so the reveal never celebrates a result
    // that then turns out lower or held.
    if (data.revealPending) {
      return RecapPlaceholder(data: data, attemptId: id, onRetry: () => retryRecapData(ref, id));
    }
    return RecapFlow(model: model, entry: ritual.decayed ? SheetEntry.sealedDecayed : SheetEntry.sealed, ritual: ritual);
  }
}

/// `/result/:attemptId/recap/:card`: Replay recap and "Continue recap, card 3 of 4". The sheet
/// is already open; nothing is torn again.
class RecapScreen extends ConsumerWidget {
  const RecapScreen({super.key, required this.attemptId, required this.card});

  final String attemptId;
  final int card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(recapDataProvider(attemptId));
    final model = data.model;
    if (model == null) {
      return RecapPlaceholder(data: data, attemptId: attemptId, onRetry: () => retryRecapData(ref, attemptId));
    }
    if (data.revealPending) {
      return RecapPlaceholder(data: data, attemptId: attemptId, onRetry: () => retryRecapData(ref, attemptId));
    }
    return RecapFlow(model: model, entry: SheetEntry.open, initialCard: card);
  }
}
