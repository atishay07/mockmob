import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../compass/compass_controller.dart';
import '../copy.dart';
import '../data/tools_store.dart';
import '../tools_paths.dart';
import '../widgets/sources_sheet.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_page.dart';
import '../widgets/web_link.dart';

/// CUET tools (`/tools`, pushed from You): Compass first (with what the student's own subjects
/// open, once the DU data is on the phone), then the planner, the 2027 guide and the sources.
/// Mobi hops once, the first time the hub is opened on a phone.
class ToolsHubScreen extends ConsumerStatefulWidget {
  const ToolsHubScreen({super.key});

  @override
  ConsumerState<ToolsHubScreen> createState() => _ToolsHubScreenState();
}

class _ToolsHubScreenState extends ConsumerState<ToolsHubScreen> {
  bool _firstOpen = false;

  @override
  void initState() {
    super.initState();
    unawaited(_resolveFirstOpen());
  }

  Future<void> _resolveFirstOpen() async {
    final store = ref.read(toolsStoreProvider);
    final seen = await store.hubSeen();
    if (seen) return;
    unawaited(store.markHubSeen());
    if (mounted) setState(() => _firstOpen = true);
  }

  @override
  Widget build(BuildContext context) {
    final compass = ref.watch(compassControllerProvider).value;
    return ToolsPage(
      title: ToolsCopy.hubTitle,
      lead: ToolsCopy.hubLead,
      slivers: [
        SliverToBoxAdapter(child: CompassFeature(state: compass, greet: _firstOpen)),
        // One flat list on the ground, one icon column, no card behind it.
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: MmRhythm.group),
            child: ToolsFlatList(
              children: [
                ToolsLinkRow(
                  flat: true,
                  icon: LucideIcons.layoutGrid,
                  title: ToolsCopy.comboTitle,
                  note: ToolsCopy.comboNote,
                  onTap: () => context.push(ToolsPaths.combo),
                ),
                ToolsLinkRow(
                  flat: true,
                  icon: LucideIcons.calendarRange,
                  title: ToolsCopy.guideTitle,
                  note: ToolsCopy.guideNote,
                  onTap: () => context.push(ToolsPaths.guide2027),
                ),
                ToolsLinkRow(
                  flat: true,
                  icon: LucideIcons.bookOpen,
                  title: ToolsCopy.pyqTitle,
                  note: ToolsCopy.pyqNote,
                  external: true,
                  onTap: () => openWebPage(ref, ToolsPaths.pyqGuideWebPath),
                ),
                if (compass != null)
                  ToolsLinkRow(
                    flat: true,
                    icon: LucideIcons.fileText,
                    title: ToolsCopy.sourcesTitle,
                    note: ToolsCopy.sourcesNote,
                    onTap: () => showSourcesSheet(context, compass.catalog.meta.sources),
                  ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: ToolsNote(ToolsCopy.dataLine, top: MmRhythm.group)),
      ],
    );
  }
}

/// The lit Compass pane: what the student's subjects open (real, from DU's rules) when known,
/// otherwise what Compass does. One key into Compass.
class CompassFeature extends StatelessWidget {
  const CompassFeature({super.key, required this.state, this.greet = false});

  final CompassState? state;

  /// Mobi hops beside the title (the first time the hub is opened).
  final bool greet;

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
              Expanded(child: Text(ToolsCopy.compassTitle, style: type.labelLarge.copyWith(color: colors.ink2))),
              if (greet) const Mobi(pose: MobiPose.cheer, size: 52),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          if (known) ...[
            MergeSemantics(
              child: Row(
                children: [
                  ToolsRing(
                    fraction: s.total == 0 ? 0 : s.eligible.length / s.total,
                    child: ToolsNumber(value: '${s.eligible.length}', semanticsLabel: '${s.eligible.length} ${ToolsCopy.hubOfTotal(s.total)}'),
                  ),
                  const SizedBox(width: MmSpace.s20),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ToolsCopy.hubOfTotal(s.total), style: type.cardTitle),
                        const SizedBox(height: MmSpace.s4),
                        Text(ToolsCopy.hubOpens(s.selection.count), style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
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
