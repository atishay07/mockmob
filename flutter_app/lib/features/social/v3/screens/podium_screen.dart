// R7 the podium (MOB-BUILD-SPEC-V3 5.3 R7, 5.6 M7). Loads the podium and the game (for its title
// and the server's clock), then plays the stage (widgets/podium_stage.dart). Before your run is
// finished the server answers PODIUM_NOT_YET, and the screen says so with a Back key.
//
// "Ask for a rematch": anyone with a start opens P2 prefilled with this game's format, length and
// chapter; otherwise it sends the "Again?" sticker and says so quietly.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_providers.dart' show nowProvider;
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import '../widgets/fold_manifest.dart';
import '../widgets/mob_fx.dart';
import '../widgets/podium_stage.dart';
import '../widgets/start_game_sheet.dart';

class PodiumScreen extends ConsumerStatefulWidget {
  const PodiumScreen({super.key, required this.gameId});
  final String gameId;

  @override
  ConsumerState<PodiumScreen> createState() => _PodiumScreenState();
}

class _PodiumScreenState extends ConsumerState<PodiumScreen> {
  late Future<({Podium podium, MobGame? game})> _load = _fetch();

  @override
  void initState() {
    super.initState();
    FoilSheenProgram.precache();
  }

  Future<({Podium podium, MobGame? game})> _fetch() async {
    final api = ref.read(mobV3ApiProvider);
    final podium = await api.podium(widget.gameId);
    MobGame? game;
    try {
      game = await api.game(widget.gameId);
    } on Object {
      game = null;
    }
    if (mounted) {
      final first = [for (final p in podium.places) if (p.place == 1) p.fold];
      // The first-place Fold uses the 512 still; warm it before its turn.
      precacheFolds(context, first, large: true);
      precacheFolds(context, [for (final p in podium.places) p.fold]);
    }
    return (podium: podium, game: game);
  }

  void _close() => Navigator.of(context).maybePop();

  Future<void> _rematch(MobGame? game) async {
    final den = ref.read(denViewProvider);
    if (den?.v3.starts.can ?? false) {
      await showStartGame(
        context,
        prefill: StartGamePrefill(format: game?.format ?? GameFormat.sprint, count: game?.count ?? 5, chapter: game?.chapter, rematchOf: widget.gameId),
      );
      return;
    }
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      final sent = await ref.read(mobV3ActionsProvider).sticker(StickerKind.again, game: widget.gameId);
      if (!sent || !mounted) return;
      messenger?.showSnackBar(SnackBar(content: Text(MobV3Copy.rematchAsked), behavior: SnackBarBehavior.floating, duration: const Duration(seconds: 3)));
    } on Object catch (e) {
      if (!mounted) return;
      messenger?.showSnackBar(SnackBar(content: Text(MobV3Copy.error(e)), behavior: SnackBarBehavior.floating));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: FutureBuilder<({Podium podium, MobGame? game})>(
          future: _load,
          builder: (context, snap) {
            if (snap.hasError) {
              return _Refused(
                message: MobV3Copy.error(snap.error!),
                onBack: _close,
                onRetry: _isNotYet(snap.error!) ? null : () => setState(() => _load = _fetch()),
              );
            }
            final data = snap.data;
            if (data == null) return const SizedBox.expand();
            final game = data.game;
            final now = game?.serverNow ?? ref.read(nowProvider)();
            return PodiumStage(
              podium: data.podium,
              gameTitle: game?.title ?? '',
              now: now,
              onClose: _close,
              onMoments: () => MobV3Nav.moments(context, widget.gameId),
              onRematch: () => _rematch(game),
            );
          },
        ),
      ),
    );
  }

  bool _isNotYet(Object e) {
    try {
      final dynamic d = e;
      return d.code == 'PODIUM_NOT_YET';
    } on Object {
      return false;
    }
  }
}

/// PODIUM_NOT_YET (finish your run first) or a failed read: the sentence and Back.
class _Refused extends StatelessWidget {
  const _Refused({required this.message, required this.onBack, this.onRetry});

  final String message;
  final VoidCallback onBack;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.momentGutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            Text(message, key: const ValueKey('podium-refused'), style: type.title.copyWith(color: c.ink)),
            const Spacer(),
            if (onRetry != null) ...[
              KeyButton(label: MobV3Copy.tryAgain, onPressed: onRetry),
              const SizedBox(height: MmSpace.s12),
              KeyButton.secondary(label: MobV3Copy.back, onPressed: onBack),
            ] else
              KeyButton(label: MobV3Copy.back, onPressed: onBack),
          ],
        ),
      ),
    );
  }
}
