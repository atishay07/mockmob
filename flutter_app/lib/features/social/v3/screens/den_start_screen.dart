// D0 No Mob, and the D0a Start a Mob sheet (spec 5.3).
//
// D0: the Mob tab for a student in no Mob. The lamp-lit room with your starter Fold and four dashed
// paper seats, one line of what a Mob is, the volt key "Start a Mob" and "Join with a code". With no
// subjects chosen, the one way forward is "Choose your subjects" (a Mob plays in one of them).
//
// D0a: a sheet. Pick the Mob's name from the kind list (six at a time), the subject, your Fold (four
// starter cards the first time, then "You play as Dart" with Change), your first name in the Mob and a
// colour, then the key "Start <name>". Errors are the server's sentence, inline.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_state.dart';
import '../../../../core/auth/display_name.dart' show shownName;
import '../../../../core/haptics/haptics.dart';
import '../../../../core/models/subject.dart' show isHiddenSubject;
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../insights/ask_mobi.dart' show AskMobiButton;
import '../../../practice/widgets/stale_subjects_banner.dart' show openEditSubjects;
import '../../../you/data/subject_catalog.dart' show youSubjectNames;
import '../../copy.dart';
import '../../data/mob_models.dart' show Mob, isValidMobName, mobNameFrom;
import '../../data/mob_repository.dart' show mobRepositoryProvider;
import '../../widgets/mob_parts.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/mob_say.dart';
import '../logic/mob_names.dart';
import '../mob_v3_nav.dart';
import '../widgets/den_preview.dart';
import '../widgets/fold_picker.dart';
import '../widgets/mob_fx.dart';
import '../widgets/mob_name_chips.dart';

/// The subjects a Mob can be started in: the student's own, as the old form read them.
final mobStartSubjectsProvider = Provider<List<String>>((ref) {
  final all = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  return [for (final s in all) if (RegExp(r'^[a-z][a-z_]{1,40}$').hasMatch(s) && !isHiddenSubject(s)) s];
});

String _subjectLabel(String s) => youSubjectNames[s] ?? Mob(subject: s).subjectName;

class DenStartScreen extends ConsumerWidget {
  const DenStartScreen({super.key, this.asTab = true});

  /// The Mob tab's root draws the tab header (account key, title, Ask Mobi). Pushed, it is the same row.
  final bool asTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final seat = ref.watch(mobRepositoryProvider.select((s) => s.value?.v3?.seat));
    final subjects = ref.watch(mobStartSubjectsProvider);
    final noSubjects = subjects.isEmpty;
    final auth = ref.watch(authSnapshotProvider);
    final first = mobNameFrom(shownName(auth.name, email: auth.email));
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmRhythm.screenTop, MmSpace.gutter, MmSpace.s8),
                      child: const TabRootHeader(title: MobV3Copy.title, trailing: AskMobiButton()),
                    ),
                  ),
                ),
                SliverToBoxAdapter(child: DenPreview(fold: seat ?? FoldKey.dart, fallbackName: first)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, 0),
                  sliver: SliverList.list(
                    children: [
                      Text(MobV3Copy.d0Lead, style: type.body.copyWith(color: c.ink2)),
                      const SizedBox(height: MmSpace.s24),
                      if (noSubjects) ...[
                        Text(MobV3Copy.noSubjects, style: type.body.copyWith(color: c.ink)),
                        const SizedBox(height: MmSpace.s16),
                        KeyButton(key: const ValueKey('d0-choose-subjects'), label: MobV3Copy.chooseSubjects, onPressed: () => openEditSubjects(context)),
                      ] else
                        KeyButton(key: const ValueKey('d0-start'), label: MobV3Copy.startMob, onPressed: () => MobV3Nav.startMob(context)),
                      const SizedBox(height: MmSpace.s12),
                      KeyButton.secondary(key: const ValueKey('d0-join'), label: MobV3Copy.joinWithCode, onPressed: () => MobV3Nav.joinMob(context)),
                      const SizedBox(height: MmSpace.s4),
                      Center(child: KeyButton.quiet(key: const ValueKey('d0-how'), label: MobExplainerCopy.howItWorks, expanded: false, onPressed: () => MobV3Nav.howItWorks(context))),
                      SizedBox(height: MmSpace.s32 + MediaQuery.viewPaddingOf(context).bottom),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// D0a
// ---------------------------------------------------------------------------------------------------

/// The state of the Start a Mob sheet, held outside the sheet's widgets so the pinned key (the sheet's
/// footer) and the body read the same choices. It uses the app's container, never a widget's ref, so it
/// still works after the Mob appears and the page under the sheet has changed.
class StartMobModel extends ChangeNotifier {
  StartMobModel({required this.container, required this.subjects, FoldKey? seat, String namePrefill = ''})
      : seat = seat,
        fold = seat ?? FoldKey.dart,
        subject = subjects.isEmpty ? null : subjects.first,
        name = TextEditingController(text: namePrefill),
        colour = namePrefill.isEmpty ? 0 : namePrefill.codeUnits.fold<int>(0, (a, b) => a + b) % MobColours.count;

  final ProviderContainer container;
  final List<String> subjects;

  /// Null on a fresh account: the four starter cards show. Set: "You play as Dart" with Change.
  final FoldKey? seat;
  FoldKey fold;
  int nameKey = 0;
  String? subject;
  int colour;
  final TextEditingController name;

  bool busy = false;
  String? error;
  String? nameError;
  bool subjectsFirst = false;

  bool get firstTime => seat == null;
  String get mobName => mobNameOf(nameKey);

  void _set(VoidCallback f) {
    f();
    notifyListeners();
  }

  void pickName(int key) => _set(() => nameKey = key);
  void pickSubject(String s) => _set(() => subject = s);
  void pickFold(FoldKey f) => _set(() => fold = f);
  void pickColour(int i) => _set(() => colour = i);
  void nameEdited() => _set(() => nameError = null);

  /// Calls the server. True when the Mob started.
  Future<bool> start() async {
    final s = subject;
    if (busy || s == null) return false;
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
      await container.read(mobV3ActionsProvider).createMob(subject: s, name: name.text.trim(), colour: colour, nameKey: nameKey, fold: fold);
      container.read(hapticsProvider).confirm();
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

/// Opens D0a. Completes when the sheet closes (true when a Mob started). The model is not disposed by
/// hand: the sheet rebuilds its body when the keyboard opens (a different tree shape), so a widget cannot
/// own it, and a delayed dispose would leave a timer behind. It holds one text controller, no listener
/// outlives the sheet, and it is collected with the route.
Future<bool?> showStartMobSheet(BuildContext context) {
  final container = ProviderScope.containerOf(context, listen: false);
  final auth = container.read(authSnapshotProvider);
  final model = StartMobModel(
    container: container,
    subjects: container.read(mobStartSubjectsProvider),
    seat: container.read(mobRepositoryProvider).value?.v3?.seat,
    namePrefill: mobNameFrom(shownName(auth.name, email: auth.email)),
  );
  return showMmSheet<bool>(
    context: context,
    title: MobV3Copy.startSheetTitle,
    heightFactor: 0.92,
    builder: (_) => StartMobBody(model: model),
    footer: (sheet) => StartMobKey(model: model, onStarted: () => Navigator.of(sheet).pop(true)),
  );
}

/// The key pinned under the sheet: "Start Chai Circle", with what comes next under it.
class StartMobKey extends StatelessWidget {
  const StartMobKey({super.key, required this.model, required this.onStarted});

  final StartMobModel model;
  final VoidCallback onStarted;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyButton(
            key: const ValueKey('d0a-start'),
            label: MobV3Copy.startKey(model.mobName),
            loading: model.busy,
            onPressed: model.busy || model.subject == null
                ? null
                : () async {
                    if (await model.start()) onStarted();
                  },
          ),
          const SizedBox(height: MmSpace.s8),
          MobNote(MobV3Copy.startNext, center: true),
        ],
      ),
    );
  }
}

class StartMobBody extends ConsumerWidget {
  const StartMobBody({super.key, required this.model});

  final StartMobModel model;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        Widget heading(String t) => Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Semantics(header: true, child: Text(t, style: type.subhead.copyWith(color: c.ink))),
            );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            heading(MobV3Copy.pickName),
            MobNameChips(selected: model.nameKey, onChanged: model.pickName),
            const SizedBox(height: MmSpace.s16),
            heading(MobV3Copy.subjectYouPlay),
            Wrap(
              spacing: MmSpace.s8,
              runSpacing: MmSpace.s4,
              children: [for (final s in model.subjects) MobPickChip(label: _subjectLabel(s), selected: model.subject == s, onTap: () => model.pickSubject(s))],
            ),
            const SizedBox(height: MmSpace.s24),
            if (model.firstTime) ...[
              heading(MobV3Copy.pickFold),
              FoldPickerCards(folds: FoldKey.starters, selected: model.fold, onChanged: model.pickFold),
            ] else
              _SeatRow(model: model),
            const SizedBox(height: MmSpace.s24),
            MobNameField(controller: model.name, label: MobV3Copy.nameLabel, error: model.nameError, onChanged: (_) => model.nameEdited()),
            const SizedBox(height: MmSpace.s4),
            MobNote(MobV3Copy.nameNote),
            const SizedBox(height: MmSpace.s16),
            Text(MobV3Copy.colourLabel, style: type.label.copyWith(color: c.ink2)),
            ColourPicker(value: model.colour, onChanged: model.pickColour),
            const SizedBox(height: MmSpace.s16),
            MobNote(MobV3Copy.marksNote),
            if (model.error != null) ...[
              const SizedBox(height: MmSpace.s12),
              InlineBanner(message: model.error!, tone: BannerTone.error),
              if (model.subjectsFirst) ...[
                const SizedBox(height: MmSpace.s8),
                KeyButton.secondary(label: MobV3Copy.chooseSubjects, onPressed: () => openEditSubjects(context)),
              ],
            ],
            const SizedBox(height: MmSpace.s8),
          ],
        );
      },
    );
  }
}

/// Later times: "You play as Dart", with Change (owned Folds only).
class _SeatRow extends StatelessWidget {
  const _SeatRow({required this.model});

  final StartMobModel model;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(color: c.raised2, borderRadius: MmRadius.keyAll, border: Border.all(color: c.line)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s8, MmSpace.s8),
        child: Row(
          children: [
            FoldHeadDisc(fold: model.fold, size: 44),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(MobV3Copy.youPlayAs(MobV3Copy.foldName(model.fold)), style: type.subhead.copyWith(color: c.ink))),
            KeyButton.quiet(
              key: const ValueKey('d0a-change-fold'),
              label: MobV3Copy.change,
              onPressed: () async {
                final f = await showFoldChooser(context, selected: model.fold);
                if (f != null) model.pickFold(f);
              },
            ),
          ],
        ),
      ),
    );
  }
}
