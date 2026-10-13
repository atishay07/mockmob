import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../tools_paths.dart';
import '../widgets/sources_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import '../widgets/web_link.dart';

/// CUET tools (`/tools`, pushed from You): Compass first (with what the student's own subjects
/// open, once the DU data is on the phone), then the planner, the 2027 guide and the sources.
class ToolsHubScreen extends ConsumerWidget {
  const ToolsHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final compass = ref.watch(compassControllerProvider).value;
    return ToolsPage(
      title: ToolsCopy.hubTitle,
      lead: ToolsCopy.hubLead,
      slivers: [
        SliverToBoxAdapter(child: CompassFeature(state: compass)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s24),
            child: YouPanel(
              inset: 64,
              children: [
                YouRow(icon: LucideIcons.layoutGrid, title: ToolsCopy.comboTitle, note: ToolsCopy.comboNote, onTap: () => context.push(ToolsPaths.combo)),
                YouRow(icon: LucideIcons.calendarRange, title: ToolsCopy.guideTitle, note: ToolsCopy.guideNote, onTap: () => context.push(ToolsPaths.guide2027)),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: YouPanel(
              inset: 64,
              children: [
                YouRow(
                  icon: LucideIcons.bookOpen,
                  title: ToolsCopy.pyqTitle,
                  note: ToolsCopy.pyqNote,
                  external: true,
                  onTap: () => openWebPage(ref, ToolsPaths.pyqGuideWebPath),
                ),
                if (compass != null)
                  YouRow(
                    icon: LucideIcons.fileText,
                    title: ToolsCopy.sourcesTitle,
                    note: ToolsCopy.sourcesNote,
                    onTap: () => showSourcesSheet(context, compass.catalog.meta.sources),
                  ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmSpace.s20)),
      ],
    );
  }
}

/// The lit Compass pane: what the student's subjects open (real, from DU's rules) when known,
/// otherwise what Compass does. One key into Compass.
class CompassFeature extends StatelessWidget {
  const CompassFeature({super.key, required this.state});

  final CompassState? state;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = state;
    final known = s != null && !s.selection.isEmpty;
    return ToolsCard(
      lit: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(LucideIcons.compass, size: 20, color: colors.accentText),
              const SizedBox(width: MmSpace.s8),
              Text(ToolsCopy.compassTitle, style: type.labelLarge.copyWith(color: colors.ink2)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          if (known) ...[
            MonumentalNumber(value: '${s.eligible.length}', unit: 'of ${s.total}', style: type.figure, roll: false),
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.hubOpens(s.selection.count), style: type.body),
          ] else ...[
            Text(ToolsCopy.compassQuestion, style: type.headline.copyWith(fontSize: 24, height: 28 / 24)),
            const SizedBox(height: MmSpace.s8),
            Text(ToolsCopy.compassHubNote, style: type.body.copyWith(color: colors.ink2)),
          ],
          const SizedBox(height: MmSpace.s20),
          KeyButton(label: ToolsCopy.openCompass, onPressed: () => context.push(ToolsPaths.compass)),
        ],
      ),
    );
  }
}
