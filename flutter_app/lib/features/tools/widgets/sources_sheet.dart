import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/external_link_opener.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_models.dart';
import 'tools_page.dart';

/// The official University of Delhi documents behind every rule and cutoff, each opening in a
/// Custom Tab.
Future<void> showSourcesSheet(BuildContext context, List<DuDocument> sources) {
  return showMmSheet<void>(
    context: context,
    title: ToolsCopy.sourcesTitle,
    builder: (context) => Consumer(
      builder: (context, ref, _) {
        final colors = context.mmColors;
        final type = context.mmType;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ToolsCopy.sourcesLead, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            for (final s in sources)
              ToolsRowFrame(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                semanticsLabel: '${s.title}. ${s.use}. Opens in the browser',
                onTap: () {
                  final uri = Uri.tryParse(s.url);
                  if (uri != null) ref.read(externalLinkOpenerProvider).open(uri);
                },
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.title, style: type.labelLarge),
                          const SizedBox(height: 2),
                          Text(s.use, style: type.caption.copyWith(color: colors.ink2)),
                        ],
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Icon(LucideIcons.externalLink, size: 16, color: colors.ink3),
                  ],
                ),
              ),
          ],
        );
      },
    ),
  );
}
