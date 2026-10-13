import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/theme/theme.dart';
import '../widgets/save_glyph.dart';
import '../widgets/tap_slop.dart';
import 'nta_copy.dart';
import 'nta_skin.dart';

/// The line under the bar: the paper's one section tab on the left, then the warnings pill and
/// the save state. A 5 or 1 minute warning covers the tab for three seconds; nothing moves.
class NtaStatusStrip extends StatelessWidget {
  const NtaStatusStrip({
    super.key,
    required this.subject,
    required this.strikes,
    required this.save,
    required this.showSave,
    this.warning,
    this.onRetrySave,
  });

  /// The strip's height. While the retry shows, a [TapSlop] makes up the rest of its 48 dp: the
  /// paper below is hit-tested first and keeps its edge, so the band reaches up into the bar's
  /// bottom margin, where nothing else takes taps.
  static const double height = 44;

  final String subject;
  final int strikes;
  final ValueListenable<SaveSnapshot> save;

  /// False before the first answer: nothing to call saved yet.
  final bool showSave;
  final String? warning;

  /// A tap on "Not saved yet. Tap to retry".
  final VoidCallback? onRetrySave;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final colors = skin.colors;
    final type = context.mmType;
    // The slop is the strip's outermost box: a parent box would turn away taps outside itself.
    return ValueListenableBuilder<SaveSnapshot>(
      valueListenable: save,
      builder: (context, snapshot, strip) => TapSlop(
        vertical: onRetrySave != null && snapshot.state == SaveState.notSaved ? MmTarget.min - height : 0,
        child: strip,
      ),
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            border: Border(bottom: BorderSide(color: colors.line)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: SizedBox(
              height: height,
              child: Row(
                children: [
                  Expanded(
                    child: Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        Opacity(opacity: warning == null ? 1 : 0, child: _SectionTab(subject: subject, skin: skin)),
                        if (warning != null)
                          Row(
                            children: [
                              Icon(LucideIcons.clock, size: 15, color: colors.warnText),
                              const SizedBox(width: MmSpace.s6),
                              Flexible(
                                child: Text(
                                  warning!,
                                  maxLines: 1,
                                  style: type.caption.copyWith(color: colors.warnText, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                  if (strikes > 0) ...[const SizedBox(width: MmSpace.s8), _WarningsPill(strikes: strikes)],
                  ValueListenableBuilder<SaveSnapshot>(
                    valueListenable: save,
                    builder: (context, snapshot, _) {
                      if (!showSave && snapshot.state == SaveState.saved) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(left: MmSpace.s12),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 150),
                          child: SaveGlyph(snapshot: snapshot, onRetry: onRetrySave, lineHeight: height),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionTab extends StatelessWidget {
  const _SectionTab({required this.subject, required this.skin});

  final String subject;
  final NtaSkin skin;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Semantics(
      label: NtaCopy.sectionSemantics(subject),
      excludeSemantics: true,
      child: IntrinsicWidth(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: '${NtaCopy.section}  ', style: type.caption.copyWith(color: skin.colors.ink3)),
                  TextSpan(text: subject, style: type.label.copyWith(color: skin.colors.ink)),
                ],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            SizedBox(height: 2, child: ColoredBox(color: skin.tabLine)),
          ],
        ),
      ),
    );
  }
}

/// "Warnings 1/3": amber at one, red from two. Words, not colour alone.
class _WarningsPill extends StatelessWidget {
  const _WarningsPill({required this.strikes});

  final int strikes;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final tone = strikes >= 2 ? colors.badText : colors.warnText;
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: MmRadius.pillAll,
        border: Border.all(color: tone.withValues(alpha: 0.55)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.eye, size: 14, color: tone),
          const SizedBox(width: MmSpace.s4),
          Text(NtaCopy.warningsPill(strikes), style: context.mmType.caption.copyWith(color: tone, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
