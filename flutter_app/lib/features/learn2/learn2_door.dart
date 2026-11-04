// Where Learn v2 meets the app's own pages (APP-1101 decisions 2 and 4): the Learn door of Practice and the
// "Chapter feeds" row in Practise's More ways in. No new tab and no new slot: the door keeps its place and only its
// content changes; the row sits among the other ways in.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/brand/brand_icon.dart';
import '../insights/insights_routes.dart' show EntryRow;
import '../learn/screens/learn_screen.dart';
import 'data/learn_api.dart' show OffLearnApi;
import 'data/learn_providers.dart';
import 'home/learn_home.dart';
import 'learn2_links.dart';

/// The Learn door's content: Learn home while the server has Learn v2 on, else the lesson library as before. The last
/// answer is kept on the phone, so a cold start waits a moment for it rather than drawing the other door.
class Learn2Door extends ConsumerStatefulWidget {
  const Learn2Door({super.key});

  @override
  ConsumerState<Learn2Door> createState() => _Learn2DoorState();
}

class _Learn2DoorState extends ConsumerState<Learn2Door> {
  bool _restored = false;

  @override
  void initState() {
    super.initState();
    // Without the Learn v2 routes (a build or a test that does not wire them) there is nothing to wait for.
    if (ref.read(learnApiProvider) is OffLearnApi) {
      _restored = true;
      return;
    }
    unawaited(ref.read(learnOnProvider.notifier).restored.then((_) {
      if (mounted) setState(() => _restored = true);
    }));
  }

  @override
  Widget build(BuildContext context) {
    final on = ref.watch(learnOnProvider);
    if (!on && !_restored) return const SizedBox(height: 480);
    if (!on) return const LearnScreen(embedded: true);
    // The door's address carries Learn home's own place: ?subject=, and ?find=1&q= for Find.
    final q = GoRouterState.of(context).uri.queryParameters;
    return LearnHome(subject: q['subject'], find: q['find'] == '1', query: q['q']);
  }
}

/// "Chapter feeds" in Practise's More ways in: Explore's covers, Key cards and questions one at a time. It opens the Explore door
/// of this same page (LK51), so Back from a feed returns to it. Nothing at all while Learn v2 is off.
class ChapterFeedsRow extends ConsumerWidget {
  const ChapterFeedsRow({super.key, required this.subject, this.divider = false});

  final String subject;

  /// A 1 px divider under the row, as the rows around it have (Practise > More ways in); none while the row itself is off.
  final bool divider;

  static const String title = 'Chapter feeds';
  static const String note = 'Key cards and questions, one at a time.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(learnOnProvider)) return const SizedBox.shrink();
    final row = EntryRow(
      icon: LucideIcons.galleryVerticalEnd,
      brand: BrandIconName.feeds,
      title: title,
      note: note,
      onTap: () => context.go(Learn2Links.explore(subject: subject)),
    );
    if (!divider) return row;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [row, Divider(height: 1, color: context.mmColors.line)],
    );
  }
}
