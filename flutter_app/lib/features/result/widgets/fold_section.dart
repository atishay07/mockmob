import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../layers_copy.dart';

/// Which folds are open, kept for this app session so a student who keeps "Your time" open finds it open on the next
/// result (RESULT-1017 4.6). A link into a fold opens it here too.
class FoldMemory extends ChangeNotifier {
  FoldMemory._();

  /// The one memory of the app session.
  static final FoldMemory instance = FoldMemory._();

  final Set<String> _open = {};

  bool isOpen(String id) => _open.contains(id);

  void set(String id, {required bool open}) {
    final changed = open ? _open.add(id) : _open.remove(id);
    if (changed) notifyListeners();
  }

  void toggle(String id) => set(id, open: !isOpen(id));

  /// Tests start every case with every fold closed.
  @visibleForTesting
  void reset() => _open.clear();
}

/// "More from this paper": the heading above the folds.
class FoldsHeading extends StatelessWidget {
  const FoldsHeading({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: MmSpace.s4),
    child: Semantics(header: true, child: Text(LayersCopy.more, style: context.mmType.title.copyWith(fontSize: 20))),
  );
}

/// One named fold of layer 4: the title, a teaser line that states the finding (so the fold is never a mystery door)
/// and a chevron. Open, its body grows in under it (260 ms ease-out, the chevron turns over 200 ms); closing is
/// faster. The body is not built while the fold is closed. Rows are ruled by hairlines, never boxed.
class FoldSection extends StatelessWidget {
  const FoldSection({super.key, required this.id, required this.title, required this.teaser, required this.builder, this.memory});

  /// The fold's name in the session's memory ("where", "time", "plan", "proof", "every").
  final String id;
  final String title;
  final String teaser;
  final WidgetBuilder builder;

  /// Defaults to the app session's memory.
  final FoldMemory? memory;

  static const Duration openDuration = Duration(milliseconds: 260);
  static const Duration closeDuration = Duration(milliseconds: 200);

  @override
  Widget build(BuildContext context) {
    final mem = memory ?? FoldMemory.instance;
    return ListenableBuilder(
      listenable: mem,
      builder: (context, _) {
        final open = mem.isOpen(id);
        final colors = context.mmColors;
        final type = context.mmType;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Divider(height: 1, thickness: 1, color: colors.line),
            MmPressable(
              onTap: () => mem.toggle(id),
              pressedScale: 0.985,
              focusRadius: MmRadius.smallAll,
              haptic: MmPressHaptic.selection,
              highlight: true,
              selected: open,
              semanticsLabel: '${LayersCopy.foldSpoken(title, open: open)}. $teaser',
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 64),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: type.cardTitle.copyWith(fontSize: 16)),
                            // Open, the body says the finding in full, so the teaser steps out of its way.
                            if (!open) ...[
                              const SizedBox(height: MmSpace.s2),
                              Text(teaser, style: type.small.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      AnimatedRotation(
                        turns: open ? 0.5 : 0,
                        duration: Motion.of(context, const Duration(milliseconds: 200)),
                        curve: Motion.out,
                        child: Icon(LucideIcons.chevronDown, size: 20, color: colors.ink3),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            MmSizeEase(
              duration: Motion.of(context, open ? openDuration : closeDuration),
              curve: Motion.out,
              alignment: Alignment.topCenter,
              child: open
                  ? Padding(
                      padding: const EdgeInsets.only(top: MmSpace.s4, bottom: MmSpace.s24),
                      child: Builder(builder: builder),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ],
        );
      },
    );
  }
}
