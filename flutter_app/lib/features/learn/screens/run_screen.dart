import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/run_controller.dart';
import '../models/run_item.dart';
import '../widgets/run_pips.dart';
import '../widgets/run_step.dart';
import '../widgets/screen_bits.dart';

/// A study run (spec 5.9): recall cards or the guided lesson, one step at a time. Every step
/// is a server event; the screen shows only what the server acknowledged, plus the one step
/// waiting on this phone.
class LearnRunScreen extends ConsumerStatefulWidget {
  const LearnRunScreen({super.key, required this.runId});

  final String runId;

  @override
  ConsumerState<LearnRunScreen> createState() => _LearnRunScreenState();
}

class _LearnRunScreenState extends ConsumerState<LearnRunScreen> {
  Timer? _openNew;
  bool _ended = false;

  @override
  void dispose() {
    _openNew?.cancel();
    super.dispose();
  }

  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.learn);
    }
  }

  void _goToDone() {
    if (_ended) return;
    _ended = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go(AppRoutes.learnRunDone(widget.runId));
    });
  }

  void _openReplacement(RunUiState ui) {
    _openNew?.cancel();
    _openNew = Timer(const Duration(milliseconds: 1600), () {
      if (!mounted) return;
      final unit = ui.replacements.isEmpty ? null : ui.replacements.first.id;
      context.go(
        unit == null || unit.isEmpty
            ? AppRoutes.learn
            : AppRoutes.learnUnit(unit),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = runControllerProvider(widget.runId);
    final controller = ref.read(provider.notifier);
    final ui = ref.watch(provider);
    ref.listen(provider.select((s) => s.load), (previous, next) {
      if (next == RunLoad.changed) _openReplacement(ref.read(provider));
    });
    final run = ui.run;
    if (run != null && !run.isActive && ui.load == RunLoad.ready) _goToDone();

    final colors = context.mmColors;
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          children: [
            _header(ui),
            if (offline && ui.load == RunLoad.ready)
              const InlineBanner.offlineStrip(),
            Expanded(child: _body(ui, controller)),
          ],
        ),
      ),
    );
  }

  Widget _header(RunUiState ui) {
    final type = context.mmType;
    final colors = context.mmColors;
    final run = ui.run;
    final showRun = run != null && ui.load == RunLoad.ready && run.isActive;
    final number = showRun
        ? (run.cursor + 1).clamp(1, run.total == 0 ? 1 : run.total)
        : 0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        MmSpace.s4,
        MmSpace.s4,
        MmSpace.gutter,
        MmSpace.s8,
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconTap(
                icon: LucideIcons.x,
                label: LearnCopy.leaveRun,
                onTap: _leave,
              ),
              Expanded(
                child: Text(
                  showRun
                      ? (run.title ?? LearnCopy.reviewRunTitle)
                      : LearnCopy.title,
                  style: type.label.copyWith(color: colors.ink2),
                ),
              ),
              if (showRun && run.total > 0) ...[
                const SizedBox(width: MmSpace.s8),
                Text(
                  LearnCopy.position(run.mode, number, run.total),
                  style: type.label.copyWith(color: colors.ink),
                ),
              ],
            ],
          ),
          if (showRun)
            Padding(
              padding: const EdgeInsets.only(left: MmSpace.s12),
              child: RunPips(total: run.total, done: run.cursor),
            ),
        ],
      ),
    );
  }

  Widget _body(RunUiState ui, RunController controller) {
    switch (ui.load) {
      case RunLoad.loading:
        return const _RunSkeleton();
      case RunLoad.unavailable:
        return StateView(
          kind: StateViewKind.error,
          title: LearnCopy.runUnavailableTitle,
          message: LearnCopy.runUnavailableMessage,
          primary: StateAction(
            LearnCopy.backToLearn,
            () => context.go(AppRoutes.learn),
          ),
        );
      case RunLoad.offlineMissing:
        return StateView(
          kind: StateViewKind.offline,
          title: LearnCopy.runOfflineTitle,
          message: LearnCopy.runOfflineMessage,
          primary: StateAction(
            LearnCopy.tryAgain,
            () => unawaited(controller.load()),
          ),
          secondary: StateAction(
            LearnCopy.backToLearn,
            () => context.go(AppRoutes.learn),
          ),
        );
      case RunLoad.changed:
        return StateView(
          kind: StateViewKind.empty,
          title: LearnCopy.contentChangedOpening,
          primary: StateAction(
            LearnCopy.backToLearn,
            () => context.go(AppRoutes.learn),
          ),
        );
      case RunLoad.ready:
        final run = ui.run;
        final item = run?.currentItem;
        if (run == null || !run.isActive || item == null)
          return const _RunSkeleton();
        final actions = RunStepActions(
          reveal: () => unawaited(controller.reveal()),
          answer: (value, {bool assisted = false}) =>
              unawaited(controller.answer(value, assisted: assisted)),
          rate: (r) => unawaited(controller.rate(r)),
          advance: () => unawaited(controller.advance()),
          retry: () => unawaited(controller.flush()),
        );
        return AnimatedSwitcher(
          duration: Motion.of(context, Motion.runner),
          child: RunStep(
            key: ValueKey('${run.cursor}:${item.id}'),
            ui: ui,
            actions: actions,
            isLast: run.cursor >= run.total - 1,
          ),
        );
    }
  }
}

class _RunSkeleton extends StatelessWidget {
  const _RunSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          MmSpace.s16,
          MmSpace.gutter,
          0,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 160, radius: MmRadius.panel),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 112, radius: MmRadius.panel),
          ],
        ),
      ),
    );
  }
}
