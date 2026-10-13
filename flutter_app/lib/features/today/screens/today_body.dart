// Today's layout for a given [TodayView]: the warm room (lamp light pooled behind the header),
// the top row, the hero, anything else that is open, the week's ending card, "Your sheet" and
// the road to May. Pure layout: goldens render it from fixtures.
import 'package:flutter/material.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';
import '../widgets/also_slots.dart';
import '../widgets/move_hero.dart';
import '../widgets/resume_hero.dart';
import '../widgets/road_section.dart';
import '../widgets/sealed_hero.dart';
import '../widgets/sheet_section.dart';
import '../widgets/today_header.dart';
import '../widgets/today_skeleton.dart';

class TodayCallbacks {
  const TodayCallbacks({
    required this.onAction,
    required this.onTarget,
    this.onMinutes,
    this.onShowMe,
    this.onWeek,
    this.onChooseColleges,
    this.onRefresh,
  });

  final void Function(TodayAction action) onAction;
  final void Function(TodayTarget target) onTarget;
  final ValueChanged<int>? onMinutes;
  final void Function(String attemptId)? onShowMe;
  final VoidCallback? onWeek;
  final VoidCallback? onChooseColleges;
  final Future<void> Function()? onRefresh;
}

class TodayBody extends StatelessWidget {
  const TodayBody({
    super.key,
    required this.view,
    required this.callbacks,
    this.controller,
    this.avatar = const YouAvatarButton(),
    this.weeklyEnding,
    this.insights,
    this.roadFooter,
    this.mobiController,
    this.skeletonDelay = const Duration(milliseconds: 400),
  });

  final TodayView view;
  final TodayCallbacks callbacks;
  final ScrollController? controller;
  final Widget avatar;

  /// The rhythm module's weekly ending card, hosted under the hero when it has one to show.
  final Widget? weeklyEnding;

  /// The integrator's slot for the record finding (the Insights card, `findings[0]` with Show
  /// me). Placed under the hero; absent when null.
  final Widget? insights;

  /// A quiet line under the road to May (the CUET tools link); absent when null.
  final Widget? roadFooter;

  /// Drives Mobi when the hero is a human moment (day one, coming back, late at night).
  final MobiController? mobiController;
  final Duration skeletonDelay;

  Widget _hero() {
    final hero = view.hero;
    final cb = callbacks;
    return switch (hero) {
      null => TodaySkeleton(delay: skeletonDelay),
      MoveHero() => MoveHeroCard(
          key: const ValueKey('today-move'),
          move: hero,
          offline: view.offline,
          mobiController: mobiController,
          onAction: cb.onAction,
          onMinutes: cb.onMinutes,
          onShowMe: hero.evidenceId == null || cb.onShowMe == null ? null : () => cb.onShowMe!(hero.evidenceId!),
        ),
      SealedHero() => SealedHeroCard(
          sealed: hero,
          onOpen: () => cb.onAction(TodayAction('', GoTo(AppRoutes.resultSealed(hero.attemptId)))),
          onOpenDirectly: () => cb.onAction(TodayAction('', GoTo(AppRoutes.result(hero.attemptId)))),
        ),
      ResumeHero() => ResumeHeroCard(
          resume: hero,
          onContinue: () => cb.onAction(TodayAction('', GoTo(AppRoutes.run(hero.sessionId)), actionType: 'resume')),
        ),
      EndedHero() => EndedHeroCard(ended: hero, onAction: cb.onAction),
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final padding = MediaQuery.paddingOf(context);
    final children = <Widget>[
      TodayHeader(header: view.header, onWeek: callbacks.onWeek, avatar: avatar),
      const SizedBox(height: MmSpace.s20),
      _hero(),
      if (view.also.isNotEmpty) AlsoSlots(slots: view.also, onAction: callbacks.onAction, offline: view.offline),
      if (insights != null) ...[const SizedBox(height: MmSpace.s16), insights!],
      ?weeklyEnding,
      if (view.sheet.isNotEmpty) ...[
        const SizedBox(height: MmSpace.group),
        SheetSection(rows: view.sheet, onOpen: callbacks.onTarget),
      ],
      if (view.road != null) ...[
        const SizedBox(height: MmSpace.group),
        RoadSection(road: view.road!, onChooseColleges: callbacks.onChooseColleges, onWeek: callbacks.onWeek),
        if (roadFooter != null) ...[const SizedBox(height: MmSpace.s8), roadFooter!],
      ],
    ];

    final scroll = CustomScrollView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            MmSpace.cardGutter,
            padding.top + MmSpace.s8,
            MmSpace.cardGutter,
            padding.bottom + MmSpace.s32,
          ),
          sliver: SliverList.list(children: children),
        ),
      ],
    );

    final refresh = callbacks.onRefresh;
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        children: [
          // The lamp in the corner of the room, behind the top row and the hero.
          Positioned(left: 0, right: 0, top: 0, height: 520, child: IgnorePointer(child: LightField.lamp(context, strength: 0.9))),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: refresh == null
                  ? scroll
                  : RefreshIndicator(
                      onRefresh: refresh,
                      color: colors.ink,
                      backgroundColor: colors.raised2,
                      edgeOffset: padding.top,
                      child: scroll,
                    ),
            ),
          ),
        ],
      ),
    );
  }

}
