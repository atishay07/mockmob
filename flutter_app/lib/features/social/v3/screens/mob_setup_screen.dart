// The Mob setup, one question a screen (owner D166; D168 and D169: clean, few screens, obvious, no
// step a student does not need). It replaces the D0a sheet. MOB-EXPLAINER.md section 2, "The setup
// that follows", and the prototype's Setup 1 to 4.
//
// - A full-screen route: Back and the step dots on top (position only, never progress: T002), the den
//   preview under them, then one question with its control and one volt key.
// - The questions: your Fold (the four starters), the Mob's name (the kind list, nothing chosen), the
//   subject (your own, the first chosen: T001), what your Mob calls you (your first name, a colour).
//   A student who already sits as a Fold skips the first ("You play as Dart" with Change on the last);
//   a student with one subject skips the third (it is chosen, and the pennant shows it).
// - The preview changes as the student answers: the Fold hops into the centre seat and cheers, the
//   pennant takes the name with an engrave and a sway, the subject rises in, the tag under the Fold
//   takes the typed name and the colour.
// - Motion (section 3 tokens): a step slides out 28 dp on leave 180 and the next one in from 28 dp on
//   emphasized 300 after 90 ms, its parts rising 10 dp 45 ms apart. Reduced motion: 120 ms fades, the
//   Fold just appears. Haptics: selection on every pick, light on the keys (KeyButton's own).
// - The server call is the same as D0a's: `createMob` with the subject, the first name, the colour,
//   the name key and the Fold. Its errors are its own sentence, inline, with every answer kept.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/art/object_art.dart' show SubjectRender;
import '../../../../core/auth/auth_state.dart';
import '../../../../core/auth/display_name.dart' show shownName;
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../practice/widgets/stale_subjects_banner.dart' show openEditSubjects;
import '../../../you/data/subject_catalog.dart' show youSubjectNames;
import '../../../you/widgets/you_page.dart' show BackKey;
import '../../copy.dart';
import '../../data/mob_models.dart' show Mob, isValidMobName, mobNameFrom;
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../../mob_routes.dart' show openMobPage;
import '../../widgets/mob_parts.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/explainer_flow.dart';
import '../logic/mob_names.dart';
import '../logic/mob_say.dart';
import '../widgets/den_preview.dart' show DenOpenSeat;
import '../widgets/fold_manifest.dart' show precacheFolds;
import '../widgets/fold_picker.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';
import '../widgets/mob_name_chips.dart';
import '../widgets/moment_kit.dart' show lerpD, seg;
import '../widgets/pennant.dart';
import 'den_start_screen.dart' show mobStartSubjectsProvider;

/// A subject's name as the student chose it ("Business Studies").
String mobSubjectLabel(String s) => youSubjectNames[s] ?? Mob(subject: s).subjectName;

/// The steps this student gets, in order: no Fold question for a student who already sits as one, no
/// subject question for a student with one subject (D168: no step that is not needed).
List<SetupStep> setupStepsFor({required bool hasSeat, required int subjectCount}) => [
      if (!hasSeat) SetupStep.fold,
      SetupStep.name,
      if (subjectCount != 1) SetupStep.subject,
      SetupStep.you,
    ];

// ---------------------------------------------------------------------------------------------------
// The answers and the create call
// ---------------------------------------------------------------------------------------------------

/// The setup's answers and the create call. Held by the screen; every pick notifies, so the preview,
/// the pane and the key read the same answers.
class StartMobModel extends ChangeNotifier {
  StartMobModel({required this.container, required List<String> subjects, FoldKey? seat, String namePrefill = ''})
      : _subjects = subjects,
        seat = seat,
        fold = seat,
        subject = subjects.isEmpty ? null : subjects.first,
        name = TextEditingController(text: namePrefill),
        colour = namePrefill.isEmpty ? 0 : namePrefill.codeUnits.fold<int>(0, (a, b) => a + b) % MobColours.count;

  final ProviderContainer container;
  List<String> _subjects;
  List<String> get subjects => _subjects;

  /// The Fold the student already sits as, or null on a fresh account (the four starter cards show).
  final FoldKey? seat;

  /// Null until the student picks one (never chosen for them).
  FoldKey? fold;

  /// Null until the student picks a name (nothing is preselected).
  int? nameKey;

  /// The first of the student's subjects until they pick another (real context, editable: T001).
  String? subject;
  int colour;
  final TextEditingController name;

  bool busy = false;
  String? error;
  String? nameError;
  bool subjectsFirst = false;

  bool get firstTime => seat == null;
  String? get mobName => nameKey == null ? null : mobNameOf(nameKey);
  SetupAnswers get answers => SetupAnswers(fold: fold, nameKey: nameKey, subject: subject, name: name.text);

  void _set(VoidCallback f) {
    f();
    notifyListeners();
  }

  /// A changed answer clears the last failure's sentence: the next try is a new try.
  void _pick(VoidCallback f) => _set(() {
        f();
        error = null;
        subjectsFirst = false;
      });

  void pickFold(FoldKey f) => _pick(() => fold = f);
  void pickName(int key) => _pick(() => nameKey = key);
  void pickSubject(String s) => _pick(() => subject = s);
  void pickColour(int i) => _pick(() => colour = i);
  void nameEdited() => _pick(() => nameError = null);

  /// The student's subjects as they are now (they may choose them from the setup). The pick stays when
  /// it is still there, else the first. Called from build: no notify.
  void syncSubjects(List<String> now) {
    if (identical(now, _subjects)) return;
    _subjects = now;
    if (subject == null || !now.contains(subject)) subject = now.isEmpty ? null : now.first;
  }

  /// Calls the server. True when the Mob started.
  Future<bool> start() async {
    final s = subject;
    final f = fold;
    final k = nameKey;
    if (busy || s == null || f == null || k == null) return false;
    if (!isValidMobName(name.text)) {
      _set(() => nameError = MobCopy.nameRule);
      return false;
    }
    _set(() {
      busy = true;
      error = null;
      nameError = null;
      subjectsFirst = false;
    });
    try {
      await container.read(mobV3ActionsProvider).createMob(subject: s, name: name.text.trim(), colour: colour, nameKey: k, fold: f);
      _set(() => busy = false);
      return true;
    } on Object catch (e) {
      final say = mobV3Say(e);
      _set(() {
        busy = false;
        if (mobErrorIsName(e)) {
          nameError = say;
        } else {
          error = say;
        }
        subjectsFirst = mobErrorNeedsSubjects(e);
      });
      return false;
    }
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }
}

// ---------------------------------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------------------------------

abstract final class _SetupMotion {
  /// The slide: the old step leaves 28 dp on leave 180; the new one comes in from 28 dp on emphasized
  /// 300 after 90 ms; its parts rise 10 dp on emphasized 360 from 120 ms, 45 ms apart.
  static const double travel = 28;
  static const double rise = 10;
  static const double outMs = 180;
  static const double inDelay = 90;
  static const double inMs = 300;
  static const double riseAt = 120;
  static const double riseMs = 360;
  static const double riseStep = 45;
  static const Duration swap = Duration(milliseconds: 800);

  /// The preview while the keyboard is up: shorter, so the field and the key stay in view.
  static const double previewH = 184;
  static const double previewKeyboardH = 136;
}

class MobSetupScreen extends ConsumerStatefulWidget {
  const MobSetupScreen({super.key});

  @override
  ConsumerState<MobSetupScreen> createState() => _MobSetupScreenState();
}

class _MobSetupScreenState extends ConsumerState<MobSetupScreen> with SingleTickerProviderStateMixin {
  late final StartMobModel _model;
  late final List<SetupStep> _steps;
  late final AnimationController _swap = AnimationController(vsync: this, duration: _SetupMotion.swap);

  /// The step showing (an index into [_steps]), the one leaving, and which way they move.
  int _at = 0;
  int? _from;
  int _dir = 1;
  bool _entered = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authSnapshotProvider);
    final subjects = ref.read(mobStartSubjectsProvider);
    final seat = ref.read(mobRepositoryProvider).value?.v3?.seat;
    _model = StartMobModel(
      container: ProviderScope.containerOf(context, listen: false),
      subjects: subjects,
      seat: seat,
      namePrefill: mobNameFrom(shownName(auth.name, email: auth.email)),
    )..addListener(_changed);
    _steps = setupStepsFor(hasSeat: seat != null, subjectCount: subjects.length);
    _swap.addStatusListener((s) {
      if (s == AnimationStatus.completed && _from != null && mounted) setState(() => _from = null);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_entered) return;
    _entered = true;
    // The Folds the den may show, standing and cheering, so a pick never waits on a decode.
    final folds = [...FoldKey.starters, ?_model.seat];
    unawaited(precacheFolds(context, folds).then((_) => mounted ? precacheFolds(context, folds, pose: FoldPose.cheer) : null));
    // The first question's parts rise in as the page arrives; reduced motion shows them at once.
    if (MobFx.reduced(context)) {
      _swap.value = 1;
    } else {
      _swap.forward(from: 0);
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _model
      ..removeListener(_changed)
      ..dispose();
    _swap.dispose();
    super.dispose();
  }

  SetupStep get _step => _steps[_at];

  void _go(int to) {
    if (to == _at || to < 0 || to >= _steps.length) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final reduced = MobFx.reduced(context);
    setState(() {
      _dir = to > _at ? 1 : -1;
      _from = reduced ? null : _at;
      _at = to;
    });
    _swap.duration = reduced ? MotionDurations.reducedFade : _SetupMotion.swap;
    _swap.forward(from: 0);
  }

  /// Back steps back; on the first question it leaves to D0 (or opens the Mob tab when the setup is the
  /// only page, an invite link's).
  void _back() {
    if (_model.busy) return;
    if (_at > 0) {
      _go(_at - 1);
      return;
    }
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
    } else {
      openMobPage(context);
    }
  }

  Future<void> _onKey() async {
    final step = _step;
    if (step == SetupStep.subject && _model.subjects.isEmpty) {
      openEditSubjects(context);
      return;
    }
    if (step != SetupStep.you) {
      _go(_at + 1);
      return;
    }
    if (!await _model.start() || !mounted) return;
    // The den then shows the new Mob, as it did after D0a.
    setState(() => _done = true);
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop(true);
    } else {
      await openMobPage(context);
    }
  }

  /// The key under the question: what it does, and whether it may go on yet.
  (String, bool) _keyFor(SetupStep step) {
    final a = _model.answers;
    final ok = SetupAnswers.canGoOn(step, a);
    return switch (step) {
      SetupStep.fold => (ok ? MobExplainerCopy.next : MobV3Copy.pickFold, ok),
      SetupStep.name => (ok ? MobExplainerCopy.next : MobV3Copy.pickName, ok),
      SetupStep.subject => _model.subjects.isEmpty ? (MobV3Copy.chooseSubjects, true) : (MobExplainerCopy.next, ok),
      SetupStep.you => (isValidMobName(a.name) ? MobV3Copy.startKey(_model.mobName ?? MobExplainerCopy.yourMob) : MobExplainerCopy.typeYourName, ok),
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    _model.syncSubjects(ref.watch(mobStartSubjectsProvider));
    final reduced = MobFx.reduced(context);
    // The keyboard: the preview gives up some height so the field and the key stay in view.
    final keyboard = (MediaQuery.viewInsetsOf(context).bottom / 240).clamp(0.0, 1.0);
    // A short phone (walk 20 Oct: 731 dp of screen) gives the preview less height, so the four Fold cards
    // and their lines stay above the key without scrolling.
    final mq = MediaQuery.of(context);
    final room = mq.size.height - mq.padding.vertical;
    final fitH = (room - 592).clamp(_SetupMotion.previewKeyboardH, _SetupMotion.previewH);
    final previewH = lerpD(fitH, _SetupMotion.previewKeyboardH, keyboard);
    final step = _step;
    final last = step == SetupStep.you;
    final showSubject = step == SetupStep.subject || step == SetupStep.you;
    final (label, enabled) = _keyFor(step);
    return PopScope(
      canPop: _done || (_at == 0 && !_model.busy),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        backgroundColor: c.ground,
        body: MobIdleScope(
          child: SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _TopBar(index: _at, count: _steps.length, onBack: _back),
                    SizedBox(
                      height: previewH,
                      child: SetupPreview(
                        fold: _model.fold,
                        mobName: _model.mobName,
                        subject: showSubject && _model.subject != null ? mobSubjectLabel(_model.subject!) : null,
                        tagName: last ? _model.name.text.trim() : null,
                        tagColour: _model.colour,
                        fullHeight: _SetupMotion.previewH,
                      ),
                    ),
                    Expanded(
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (_from case final from?)
                            KeyedSubtree(
                              key: ValueKey('setup-pane-${_steps[from].name}'),
                              child: _PaneFrame(clock: _swap, role: _PaneRole.leaving, dir: _dir, reduced: reduced, child: _pane(_steps[from], active: false, reduced: reduced)),
                            ),
                          KeyedSubtree(
                            key: ValueKey('setup-pane-${step.name}'),
                            child: _PaneFrame(
                              clock: _swap,
                              role: _from == null && !reduced ? _PaneRole.first : _PaneRole.coming,
                              dir: _dir,
                              reduced: reduced,
                              child: _pane(step, active: true, reduced: reduced),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _KeyArea(
                      model: _model,
                      label: label,
                      onPressed: enabled ? _onKey : null,
                      note: last && keyboard == 0 ? MobV3Copy.startNext : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _pane(SetupStep step, {required bool active, required bool reduced}) {
    final c = context.mmColors;
    final type = context.mmType;
    final haptics = ref.read(hapticsProvider);
    Widget title(String t) => Semantics(header: true, liveRegion: active, child: Text(t, style: type.screenTitle.copyWith(color: c.ink)));
    Widget line(String t) => Padding(padding: const EdgeInsets.only(top: MmSpace.s6), child: Text(t, style: type.body.copyWith(color: c.ink2)));
    final parts = switch (step) {
      SetupStep.fold => [
          title(MobExplainerCopy.foldTitle),
          line(MobExplainerCopy.foldLine),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: FoldPickerCards(folds: FoldKey.starters, selected: _model.fold, compact: true, onChanged: _model.pickFold),
          ),
        ],
      SetupStep.name => [
          title(MobExplainerCopy.nameTitle),
          line(MobV3Copy.namesKind),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: MobNameChips(selected: _model.nameKey, showNote: false, onChanged: _model.pickName),
          ),
        ],
      SetupStep.subject => [
          title(MobExplainerCopy.subjectTitle),
          line(_model.subjects.isEmpty ? MobV3Copy.noSubjects : MobExplainerCopy.subjectLine),
          if (_model.subjects.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s16),
              child: _SubjectGrid(
                subjects: _model.subjects,
                selected: _model.subject,
                onChanged: (s) {
                  haptics.selection();
                  _model.pickSubject(s);
                },
              ),
            ),
        ],
      SetupStep.you => [
          title(MobExplainerCopy.youTitle),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: MobNameField(key: const ValueKey('setup-name'), controller: _model.name, label: MobV3Copy.nameLabel, error: _model.nameError, onChanged: (_) => _model.nameEdited()),
          ),
          Padding(padding: const EdgeInsets.only(top: MmSpace.s4), child: MobNote(MobV3Copy.nameNote)),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: Text(MobV3Copy.colourLabel, style: type.label.copyWith(color: c.ink2)),
          ),
          ColourPicker(
            value: _model.colour,
            onChanged: (i) {
              haptics.selection();
              _model.pickColour(i);
            },
          ),
          if (!_model.firstTime) Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: _SeatRow(model: _model)),
          Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: MobNote(MobV3Copy.marksNote)),
        ],
    };
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < parts.length; i++) _Rise(clock: _swap, index: i, active: active && !reduced, child: parts[i]),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// The chrome: Back, the dots, the key
// ---------------------------------------------------------------------------------------------------

class _TopBar extends StatelessWidget {
  const _TopBar({required this.index, required this.count, required this.onBack});

  final int index;
  final int count;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: Row(
        children: [
          Padding(padding: const EdgeInsets.only(left: MmSpace.s4), child: BackKey(onTap: onBack)),
          Expanded(child: Center(child: SetupDots(index: index, count: count))),
          const SizedBox(width: MmTarget.min + MmSpace.s4),
        ],
      ),
    );
  }
}

/// Where the student is in their own steps: position only, never progress (T002).
class SetupDots extends StatelessWidget {
  const SetupDots({super.key, required this.index, required this.count});

  final int index;
  final int count;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final reduced = Motion.reduced(context);
    return Semantics(
      label: MobExplainerCopy.stepOf(index, count),
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < count; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              AnimatedContainer(
                key: ValueKey('setup-dot-$i'),
                duration: reduced ? Duration.zero : MotionDurations.card,
                curve: MotionCurves.emphasized,
                width: i == index ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(color: i == index ? c.ink : c.ink4, borderRadius: BorderRadius.circular(3)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _KeyArea extends StatelessWidget {
  const _KeyArea({required this.model, required this.label, required this.onPressed, this.note});

  final StartMobModel model;
  final String label;
  final VoidCallback? onPressed;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final error = model.error;
    return Padding(
      padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + MediaQuery.paddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null) ...[
            InlineBanner(key: const ValueKey('setup-error'), message: error, tone: BannerTone.error),
            if (model.subjectsFirst) ...[
              const SizedBox(height: MmSpace.s8),
              KeyButton.secondary(label: MobV3Copy.chooseSubjects, onPressed: () => openEditSubjects(context)),
            ],
            const SizedBox(height: MmSpace.s12),
          ],
          if (note != null) ...[
            MobNote(note!, center: true),
            const SizedBox(height: MmSpace.s8),
          ],
          KeyButton(key: const ValueKey('setup-key'), label: label, loading: model.busy, onPressed: onPressed),
        ],
      ),
    );
  }
}

/// A returning student's Fold: "You play as Dart", with Change (the Folds they own, never a locked one).
class _SeatRow extends StatelessWidget {
  const _SeatRow({required this.model});

  final StartMobModel model;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final fold = model.fold ?? model.seat ?? FoldKey.dart;
    return DecoratedBox(
      decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.keyAll, border: Border.all(color: c.line)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s4, MmSpace.s4, MmSpace.s4),
        child: Row(
          children: [
            FoldHeadDisc(fold: fold, size: 40),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(MobV3Copy.youPlayAs(MobV3Copy.foldName(fold)), style: type.labelLarge.copyWith(color: c.ink))),
            KeyButton.quiet(
              key: const ValueKey('setup-change-fold'),
              label: MobV3Copy.change,
              onPressed: () async {
                final f = await showFoldChooser(context, selected: fold);
                if (f != null) model.pickFold(f);
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// The panes' motion
// ---------------------------------------------------------------------------------------------------

enum _PaneRole { first, coming, leaving }

/// One question's pane on the swap clock: it slides and fades as it comes or leaves. The tree is the
/// same in every role, so a pane that stays keeps its state (the name field's focus and text).
class _PaneFrame extends StatelessWidget {
  const _PaneFrame({required this.clock, required this.role, required this.dir, required this.reduced, required this.child});

  final Animation<double> clock;
  final _PaneRole role;
  final int dir;
  final bool reduced;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: clock,
      child: RepaintBoundary(child: child),
      builder: (context, child) {
        final ms = clock.value * _SetupMotion.swap.inMilliseconds;
        var o = 1.0;
        var dx = 0.0;
        switch (role) {
          case _PaneRole.first:
            break;
          case _PaneRole.coming:
            if (reduced) {
              o = clock.value;
            } else {
              final k = seg(ms, _SetupMotion.inDelay, _SetupMotion.inMs, MotionCurves.emphasized);
              o = seg(ms, _SetupMotion.inDelay, _SetupMotion.inMs * 0.6);
              dx = _SetupMotion.travel * dir * (1 - k);
            }
          case _PaneRole.leaving:
            final k = seg(ms, 0, _SetupMotion.outMs, MotionCurves.leave);
            o = 1 - k;
            dx = -_SetupMotion.travel * dir * k;
        }
        final leaving = role == _PaneRole.leaving;
        return IgnorePointer(
          ignoring: leaving,
          child: ExcludeSemantics(
            excluding: leaving,
            child: Opacity(opacity: o.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(dx, 0), child: child)),
          ),
        );
      },
    );
  }
}

/// One part of a question rising 10 dp into place, 45 ms after the one above it.
class _Rise extends StatelessWidget {
  const _Rise({required this.clock, required this.index, required this.active, required this.child});

  final Animation<double> clock;
  final int index;
  final bool active;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: clock,
      child: child,
      builder: (context, child) {
        var o = 1.0;
        var dy = 0.0;
        if (active) {
          final ms = clock.value * _SetupMotion.swap.inMilliseconds;
          final at = _SetupMotion.riseAt + index * _SetupMotion.riseStep;
          o = seg(ms, at, _SetupMotion.riseMs * 0.6);
          dy = _SetupMotion.rise * (1 - seg(ms, at, _SetupMotion.riseMs, MotionCurves.emphasized));
        }
        return Opacity(opacity: o, child: Transform.translate(offset: Offset(0, dy), child: child));
      },
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// The subject question
// ---------------------------------------------------------------------------------------------------

class _SubjectGrid extends StatelessWidget {
  const _SubjectGrid({required this.subjects, required this.selected, required this.onChanged});

  final List<String> subjects;
  final String? selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        // Two a row when a tile keeps about 150 dp at this text size; one a row on a narrow phone.
        final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
        final two = box.maxWidth >= 300 * scale;
        const gap = MmSpace.s8;
        final w = two ? (box.maxWidth - gap) / 2 : box.maxWidth;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final s in subjects)
              SizedBox(width: w, child: _SubjectTile(key: ValueKey('setup-subject-$s'), subject: s, selected: s == selected, onTap: () => onChanged(s))),
          ],
        );
      },
    );
  }
}

/// A subject with its object art. Chosen reads at a glance: a filled ink tile with a tick on the art's
/// corner (M4), never volt (the key is the one volt thing).
class _SubjectTile extends StatelessWidget {
  const _SubjectTile({super.key, required this.subject, required this.selected, required this.onTap});

  final String subject;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final label = mobSubjectLabel(subject);
    final art = SubjectRender.of(subject)?.asset;
    final fg = selected ? c.ground : c.ink;
    return MmPressable(
      semanticsLabel: label,
      selected: selected,
      pressedScale: 0.97,
      focusRadius: BorderRadius.circular(16),
      onTap: onTap,
      builder: (context, pressed, _) => AnimatedContainer(
        duration: reduced ? Motion.reducedFade : Motion.ui,
        curve: Motion.out,
        constraints: const BoxConstraints(minHeight: 64),
        padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s8, MmSpace.s8, MmSpace.s8),
        decoration: BoxDecoration(
          color: selected ? c.ink : (pressed ? c.raised2 : c.raised),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? c.ink : c.line, width: selected ? 1.5 : 1),
        ),
        child: Row(
          children: [
            // The art, with the tick on its corner when chosen (the words keep the tile's width).
            SizedBox.square(
              dimension: 44,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: art == null
                        ? Icon(LucideIcons.bookOpen, size: 22, color: fg)
                        : Image.asset(art, fit: BoxFit.contain, filterQuality: FilterQuality.medium, excludeFromSemantics: true, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                  ),
                  if (selected)
                    Positioned(
                      right: -4,
                      bottom: -2,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(color: c.ground, shape: BoxShape.circle, border: Border.all(color: c.ink, width: 1.5)),
                        child: Icon(LucideIcons.check, size: 12, color: c.ink),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Text(label, style: type.labelLarge.copyWith(fontSize: 14, color: fg, fontWeight: selected ? FontWeight.w700 : FontWeight.w600)),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// The den preview: it changes as the student answers
// ---------------------------------------------------------------------------------------------------

/// The room above the questions: the lamp pool, four open seats, the pennant with the Mob's name (and,
/// from the subject question, the subject), and your Fold in the centre seat with its tag: "Pick a
/// Fold" before one is picked, "You" in volt, then on the last question the name being typed in the
/// chosen colour. Laid out from the floor up, so a shorter preview (the keyboard is up) keeps the
/// Fold and its tag; the pennant fades as it loses its wall.
class SetupPreview extends StatefulWidget {
  const SetupPreview({super.key, required this.fold, required this.mobName, required this.subject, required this.tagName, required this.tagColour, this.fullHeight = 184});

  final FoldKey? fold;

  /// Null until a name is picked ("Your Mob").
  final String? mobName;

  /// Shown on the pennant from the subject question on.
  final String? subject;

  /// Null before the last question; there, the name being typed ("You" while it is empty).
  final String? tagName;
  final int tagColour;
  final double fullHeight;

  @override
  State<SetupPreview> createState() => _SetupPreviewState();
}

class _SetupPreviewState extends State<SetupPreview> with TickerProviderStateMixin {
  /// The Fold's entrance: hop in from 26 dp below (60 to 500 ms), squash, the cheer from 520 to 1300.
  late final AnimationController _hop = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400), value: 1);
  late final AnimationController _leave = AnimationController(vsync: this, duration: const Duration(milliseconds: 160), value: 1);

  /// The name: an engrave (280 on out) and a sway (0, 3, −1.5, 0 degrees over 700 on out).
  late final AnimationController _pen = AnimationController(vsync: this, duration: const Duration(milliseconds: 700), value: 1);

  /// The subject line rising in (240 on out).
  late final AnimationController _line = AnimationController(vsync: this, duration: const Duration(milliseconds: 240), value: 1);
  FoldKey? _old;

  @override
  void initState() {
    super.initState();
    // The Fold that left is gone once it has faded.
    _leave.addStatusListener((s) {
      if (s == AnimationStatus.completed && _old != null && mounted) setState(() => _old = null);
    });
  }

  @override
  void didUpdateWidget(SetupPreview old) {
    super.didUpdateWidget(old);
    final reduced = MobFx.reduced(context);
    if (widget.fold != old.fold) {
      if (reduced) {
        _old = null;
        _hop.value = 1;
      } else {
        _old = old.fold;
        if (_old != null) _leave.forward(from: 0);
        _hop.forward(from: 0);
      }
    }
    if (widget.mobName != old.mobName) {
      if (reduced) {
        _pen.value = 1;
      } else {
        _pen.forward(from: 0);
      }
    }
    if (widget.subject != old.subject && widget.subject != null) {
      _line.duration = reduced ? MotionDurations.reducedFade : const Duration(milliseconds: 240);
      _line.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _hop.dispose();
    _leave.dispose();
    _pen.dispose();
    _line.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final art = c.isNight ? 'assets/art/scene-empty-nothing-night.webp' : 'assets/art/scene-empty-nothing-day.webp';
    final pennantLabel = [widget.mobName ?? MobExplainerCopy.yourMob, ?widget.subject].join(', ');
    return Semantics(
      container: true,
      label: '${MobExplainerCopy.previewLabel} $pennantLabel',
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, box) {
            final w = box.maxWidth;
            final h = box.maxHeight;
            final cx = w / 2;
            final s = (w / 360).clamp(0.86, 1.0);
            final floor = h - 26;
            // The pennant has the wall only at the full height; it fades as the keyboard takes it.
            final wall = ((h - (widget.fullHeight - 48)) / 48).clamp(0.0, 1.0);
            const pennantW = 88.0;
            return Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned.fill(
                  child: Image.asset(art, fit: BoxFit.cover, alignment: const Alignment(0.16, 0.32), filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => ColoredBox(color: c.sunken)),
                ),
                // The art meets the ground (a functional scrim, never decoration).
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: -1,
                  height: 64,
                  child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.ground.withValues(alpha: 0), c.ground]))),
                ),
                // The lamp pool under the centre seat.
                Positioned(left: cx - 130, top: floor - 34, width: 260, height: 64, child: CustomPaint(painter: _PoolPainter(night: c.isNight))),
                for (final x in [-136.0, -76.0, 76.0, 136.0])
                  Positioned(left: cx + x * s - 20, top: h - 82, child: DenOpenSeat(width: 40, height: 52)),
                if (wall > 0)
                  Positioned(
                    left: math.min(cx + 118 * s, w - pennantW / 2 - 8) - pennantW / 2,
                    top: 4 - (widget.fullHeight - h),
                    child: Opacity(opacity: wall, child: _pennant(context, pennantW, pennantLabel)),
                  ),
                if (_old case final old?)
                  _fold(
                    context,
                    old,
                    cx,
                    floor,
                    AnimatedBuilder(
                      animation: _leave,
                      builder: (context, child) {
                        final k = seg(_leave.value, 0, 1, MotionCurves.leave);
                        return Opacity(
                          opacity: 1 - k,
                          child: Transform.translate(offset: Offset(0, 6 * k), child: Transform.scale(scale: 1 - 0.04 * k, alignment: Alignment.bottomCenter, child: child)),
                        );
                      },
                      child: FoldPuppet(key: ValueKey('setup-old-${old.name}'), fold: old, size: 86, shadow: false, blink: false),
                    ),
                  ),
                if (widget.fold case final fold?)
                  _fold(
                    context,
                    fold,
                    cx,
                    floor,
                    AnimatedBuilder(
                      animation: _hop,
                      builder: (context, _) {
                        final m = _hopFrame(_hop.value * 1400);
                        return Stack(
                          clipBehavior: Clip.none,
                          alignment: Alignment.bottomCenter,
                          children: [
                            Positioned(
                              bottom: -5,
                              child: Opacity(opacity: m.shadowO, child: Transform.scale(scale: m.shadow, child: CustomPaint(size: const Size(60, 10), painter: _ShadowPainter(night: c.isNight)))),
                            ),
                            Opacity(
                              opacity: m.o,
                              child: Transform.translate(
                                offset: Offset(0, m.dy),
                                child: Transform(
                                  alignment: Alignment.bottomCenter,
                                  transform: Matrix4.diagonal3Values(m.sx, m.sy, 1),
                                  child: FoldPuppet(key: ValueKey('setup-fold-${fold.name}'), fold: fold, size: 86, shadow: false, pose: m.pose, breathe: _hop.isCompleted),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                Positioned(left: 0, right: 0, top: h - 24, child: Center(child: _Tag(fold: widget.fold, name: widget.tagName, colour: widget.tagColour))),
              ],
            );
          },
        ),
      ),
    );
  }

  /// A Fold standing with its boots on the floor at [cx].
  Widget _fold(BuildContext context, FoldKey fold, double cx, double floor, Widget child) {
    const size = 86.0;
    const w = size * 1.4;
    return Positioned(left: cx - w / 2, top: floor - size, width: w, height: size, child: Align(alignment: Alignment.bottomCenter, child: child));
  }

  Widget _pennant(BuildContext context, double width, String label) {
    final type = context.mmType;
    final ink = PennantPaper.ink(context);
    final name = widget.mobName;
    final subject = widget.subject;
    return AnimatedBuilder(
      animation: Listenable.merge([_pen, _line]),
      builder: (context, _) {
        final ms = _pen.value * 700;
        final reveal = seg(ms, 0, 280, MotionCurves.out);
        final e = MotionCurves.out.transform(_pen.value);
        final deg = e < 1 / 3 ? lerpD(0, 3, e * 3) : (e < 2 / 3 ? lerpD(3, -1.5, (e - 1 / 3) * 3) : lerpD(-1.5, 0, (e - 2 / 3) * 3));
        final lineK = MotionCurves.out.transform(_line.value);
        return Transform.rotate(
          angle: deg * math.pi / 180,
          alignment: Alignment.topCenter,
          child: Pennant(
            weeks: 0,
            width: width,
            string: 10,
            bodyRatio: 0.92,
            semanticsLabel: label,
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ClipRect(
                  clipper: _RevealClipper(reveal),
                  child: Text(
                    name ?? MobExplainerCopy.yourMob,
                    key: const ValueKey('setup-pennant-name'),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: type.label.copyWith(fontSize: 12.5, height: 1.15, fontWeight: FontWeight.w700, color: name == null ? ink.withValues(alpha: 0.6) : ink),
                  ),
                ),
                if (subject != null)
                  Opacity(
                    opacity: _line.value,
                    child: Transform.translate(
                      offset: Offset(0, 4 * (1 - lineK)),
                      child: Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Text(
                          subject,
                          key: const ValueKey('setup-pennant-subject'),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: type.caption.copyWith(fontSize: 10.5, height: 1.15, color: ink.withValues(alpha: 0.72)),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HopFrame {
  const _HopFrame({this.o = 1, this.dy = 0, this.shadow = 1, this.shadowO = 1, this.sx = 1, this.sy = 1, this.pose = FoldPose.idle});
  final double o;
  final double dy;
  final double shadow;
  final double shadowO;
  final double sx;
  final double sy;
  final FoldPose pose;
}

/// The picked Fold at [ms] after the pick: it rises from 26 dp below to 13 above (out), lands (leave),
/// squashes at the boots (1.08 x 0.88), cheers from 520 to 1300 ms, then stands.
_HopFrame _hopFrame(double ms) {
  const start = 60.0;
  const rise = 26.0;
  final pose = ms >= 520 && ms < 1300 ? FoldPose.cheer : FoldPose.idle;
  if (ms >= 1400) return const _HopFrame();
  if (ms <= start) return const _HopFrame(o: 0, dy: rise, shadow: 0.3, shadowO: 0);
  final k = ((ms - start) / 440).clamp(0.0, 1.0);
  double dy;
  double sh;
  double so;
  if (k < 0.55) {
    final a = MotionCurves.out.transform(k / 0.55);
    dy = lerpD(rise, -rise / 2, a);
    sh = lerpD(0.3, 0.6, k / 0.55);
    so = lerpD(0, 0.5, k / 0.55);
  } else {
    final a = MotionCurves.leave.transform((k - 0.55) / 0.45);
    dy = lerpD(-rise / 2, 0, a);
    sh = lerpD(0.6, 1, (k - 0.55) / 0.45);
    so = lerpD(0.5, 1, (k - 0.55) / 0.45);
  }
  // The squash at the boots, from the landing (490 ms) for 520 ms.
  var sx = 1.0;
  var sy = 1.0;
  const sq = start + 430;
  if (ms > sq && ms < sq + 520) {
    final q = (ms - sq) / 520;
    double lx(double a, double b, double s, double e) => lerpD(a, b, ((q - s) / (e - s)).clamp(0.0, 1.0));
    if (q < 0.16) {
      sx = lx(1, MobBeat.squashX, 0, 0.16);
      sy = lx(1, MobBeat.squashY, 0, 0.16);
    } else if (q < 0.34) {
      sx = MobBeat.squashX;
      sy = MobBeat.squashY;
    } else if (q < 0.62) {
      sx = lx(MobBeat.squashX, 0.97, 0.34, 0.62);
      sy = lx(MobBeat.squashY, 1.035, 0.34, 0.62);
    } else {
      sx = lx(0.97, 1, 0.62, 1);
      sy = lx(1.035, 1, 0.62, 1);
    }
  }
  return _HopFrame(o: (k / 0.55).clamp(0.0, 1.0), dy: dy, shadow: sh, shadowO: so, sx: sx, sy: sy, pose: pose);
}

/// The tag under your Fold.
class _Tag extends StatelessWidget {
  const _Tag({required this.fold, required this.name, required this.colour});

  final FoldKey? fold;
  final String? name;
  final int colour;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final named = fold != null && name != null;
    final (text, bg, fg, edge) = switch ((fold, named)) {
      (null, _) => (MobExplainerCopy.pickAFold, c.raised, c.ink2, c.line),
      (_, false) => (MobExplainerCopy.you, c.volt, c.voltInk, c.volt),
      _ => (name!.isEmpty ? MobExplainerCopy.you : name!, MobColours.of(context, colour), MobColours.inkOn(context), MobColours.of(context, colour)),
    };
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.15,
      child: AnimatedContainer(
        key: const ValueKey('setup-tag'),
        duration: reduced ? Duration.zero : Motion.ui,
        curve: Motion.out,
        constraints: const BoxConstraints(maxWidth: 160),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 2),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(MmRadius.pill), border: Border.all(color: edge)),
        child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.label.copyWith(color: fg, fontWeight: FontWeight.w700, height: 1.25)),
      ),
    );
  }
}

class _RevealClipper extends CustomClipper<Rect> {
  _RevealClipper(this.k);
  final double k;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, -4, size.width * k, size.height + 8);

  @override
  bool shouldReclip(_RevealClipper old) => old.k != k;
}

/// The warm pool of lamp light on the floor, brightest under the centre seat. Never rays.
class _PoolPainter extends CustomPainter {
  _PoolPainter({required this.night});
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    final a = night ? 0.34 : 0.22;
    const lamp = Color(0xFFF2A93B);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(1, size.height / size.width);
    final r = size.width / 2;
    canvas.drawCircle(Offset.zero, r, Paint()..shader = RadialGradient(colors: [lamp.withValues(alpha: a), lamp.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: Offset.zero, radius: r)));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_PoolPainter old) => old.night != night;
}

/// The Fold's shadow on the floor; it stays down while the Fold hops.
class _ShadowPainter extends CustomPainter {
  _ShadowPainter({required this.night});
  final bool night;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawOval(
      Offset.zero & size,
      Paint()
        ..color = Colors.black.withValues(alpha: night ? 0.42 : 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
  }

  @override
  bool shouldRepaint(_ShadowPainter old) => old.night != night;
}
