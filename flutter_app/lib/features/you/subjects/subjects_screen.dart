import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/domain/subject_options.dart';
import '../../../core/motion/motion.dart' show MmShake, MmShakeState;
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../keycards/data/keycards_models.dart' show KcHome;
import '../../keycards/data/keycards_providers.dart' show keyCardsHomeProvider;
import '../../onboarding/widgets/subject_option_picker.dart';
import '../copy.dart';
import '../data/profile_editor.dart';
import '../data/student_target.dart';
import '../data/subject_catalog.dart';
import '../edit_copy.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import 'subject_rows.dart';

/// Edit subjects (WEB-PARITY F1, the website's `/onboarding?edit=true`): every subject practice
/// can open, grouped, up to five. Saved subjects practice cannot open are listed with the
/// server's reason and a Remove key. Save writes `PATCH /api/users/{id}` and says "saved" only
/// after the server answered; a failure keeps the choices on screen.
///
/// A chosen subject whose paper has a choice (Maths, Computer Science, Accountancy: LK94) asks it
/// under its row, as the onboarding does: the saved one ticked (read from Key cards, which keep it),
/// a subject just added with its default ticked, a held subject with nothing saved with neither.
/// The choice is asked only where it can be kept and its saved state is known (Key cards on and
/// read). Save writes the subjects, then each changed option (`PUT /api/me/subject-options`).
class SubjectsScreen extends ConsumerStatefulWidget {
  const SubjectsScreen({super.key});

  @override
  ConsumerState<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends ConsumerState<SubjectsScreen> {
  /// What the account holds (updated after a save). Null until the profile has loaded: the
  /// phone's own list is only a starting point to show, never the baseline Save compares with.
  late List<String>? _saved = _profileSubjects(ref.read(authSnapshotProvider));

  /// What is ticked. Starts from the profile, or from the phone's setup answers while the
  /// profile is still loading.
  late List<String> _chosen = [..._saved ?? ref.read(studentTargetProvider).subjects];

  /// The student ticked or removed something, so a late profile must not replace the ticks.
  bool _touched = false;
  bool _saving = false;

  /// Back was confirmed with unsaved choices: the next pop goes through.
  bool _leave = false;
  String? _error;
  String? _cap;

  /// The cap sentence shakes each time a sixth subject is refused (it is already on screen from
  /// the second refusal on, so the shake is called, not triggered by a rebuild).
  final GlobalKey<MmShakeState> _shake = GlobalKey<MmShakeState>();
  DateTime? _savedAt;

  /// What the receipt says after a save: the subjects' line, or only what Learn now shows.
  String? _receipt;

  /// The options the student tapped here (subject id to option id), not saved yet.
  final Map<String, String> _picks = {};

  /// Options this screen saved, until the Key cards read that holds them is back.
  final Map<String, String> _optionsSaved = {};
  final MobiController _mobi = MobiController();

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  /// The profile's subjects once the profile is known (signed in, with subjects or told that it
  /// has none yet), else null.
  static List<String>? _profileSubjects(AuthSnapshot auth) {
    if (!auth.isSignedIn) return null;
    if (auth.subjects.isNotEmpty) return [...auth.subjects];
    return auth.needsOnboarding ? <String>[] : null;
  }

  bool get _baselineKnown => _saved != null;

  bool get _subjectsChanged {
    final saved = _saved;
    if (saved == null) return false;
    return _chosen.length != saved.length || _chosen.toSet().difference(saved.toSet()).isNotEmpty;
  }

  bool get _changed => _subjectsChanged || (_saved != null && _optionWrites(_home).isNotEmpty);

  /// The Key cards read when it can say what is saved: loaded and on. Null while it loads, failed or is off.
  KcHome? get _home {
    final home = ref.read(keyCardsHomeProvider).value?.value;
    return home != null && home.enabled ? home : null;
  }

  /// The option the account holds for [id] (this screen's own save first), or null when none is saved or it is not known.
  String? _savedOption(KcHome home, String id) {
    final own = _optionsSaved[id];
    if (own != null) return own;
    for (final s in home.subjects) {
      if (s.subject == id) return normalizeSubjectOption(id, s.option);
    }
    return null;
  }

  /// The option drawn ticked for a chosen [id]: the one tapped here, else the saved one; a subject just added starts on its
  /// default, a held one with nothing saved ticks neither (nothing is shown as saved that is not).
  String? _shownOption(KcHome home, String id) {
    final picked = _picks[id];
    if (picked != null) return picked;
    final saved = _savedOption(home, id);
    if (saved != null) return saved;
    final held = _saved?.contains(id) ?? true;
    return held ? null : defaultSubjectOption(id);
  }

  /// The options Save writes: each chosen subject with options whose ticked option is not the one saved.
  Map<String, String> _optionWrites(KcHome? home) {
    if (home == null) return const {};
    final out = <String, String>{};
    for (final id in _chosen) {
      if (subjectOptionsFor(id) == null) continue;
      final shown = _shownOption(home, id);
      if (shown != null && shown != _savedOption(home, id)) out[id] = shown;
    }
    return out;
  }

  void _pick(String id, String option) {
    setState(() {
      _touched = true;
      _error = null;
      _savedAt = null;
      _picks[id] = option;
    });
  }

  /// The profile arrived (or changed) while the screen was open.
  void _onProfile(AuthSnapshot? before, AuthSnapshot now) {
    if (_saving) return;
    final known = _profileSubjects(now);
    if (known == null) return;
    setState(() {
      _saved = known;
      if (!_touched) _chosen = [...known];
    });
  }

  void _toggle(String id) {
    setState(() {
      _touched = true;
      _error = null;
      _savedAt = null;
      if (_chosen.remove(id)) {
        _cap = null;
        _picks.remove(id);
        return;
      }
      if (_chosen.length >= kMaxProfileSubjects) {
        // Said once, in the sentence; Mobi only shrugs (no second copy of the words) and the
        // sentence shakes after this frame has put it on screen.
        _cap = EditCopy.subjectsCap;
        _mobi
          ..hush()
          ..react(MobiMoments.act(MobiEvent.refused), key: 'subjects:cap');
        WidgetsBinding.instance.addPostFrameCallback((_) => _shake.currentState?.shake());
        return;
      }
      _cap = null;
      _chosen.add(id);
    });
  }

  Future<void> _save() async {
    final subjectsChanged = _subjectsChanged;
    // Taken before the save: a subject just added keeps the default it showed.
    final writes = _optionWrites(_home);
    setState(() {
      // Held as picks until the server takes them, so a failure keeps them ticked (and Save on).
      _picks.addAll(writes);
      _saving = true;
      _error = null;
      _cap = null;
      _savedAt = null;
    });
    final editor = ref.read(profileEditorProvider);
    var subjectsSaved = false;
    try {
      if (subjectsChanged) {
        final stored = await editor.saveSubjects([..._chosen]);
        subjectsSaved = true;
        if (!mounted) return;
        // The subjects are the account's now, whatever the options do next.
        setState(() {
          _saved = [...stored];
          _chosen = [...stored];
        });
      }
      final options = {
        for (final e in writes.entries)
          if (_chosen.contains(e.key)) e.key: e.value,
      };
      final took = options.isEmpty ? const <String, String>{} : await editor.saveSubjectOptions(options);
      if (!mounted) return;
      setState(() {
        _saving = false;
        _touched = false;
        _optionsSaved.addAll(took);
        for (final id in took.keys) {
          _picks.remove(id);
        }
        final at = _savedAt = ref.read(nowProvider)();
        _receipt = subjectsChanged
            ? EditCopy.subjectsSaved(at, _chosen.length)
            : EditCopy.optionsSaved(at, [for (final e in took.entries) subjectOptionsFor(e.key)?.choice(e.value)?.label ?? e.value]);
      });
      ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.account);
      // Only after the server stored them: Mobi is proud (a nod under Quiet, nothing under Off).
      // The receipt under the list already says what changes, so he does not say it again.
      _mobi.react(MobiMoments.act(MobiEvent.milestone));
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        if (subjectsSaved || !subjectsChanged) {
          // The subjects went through (or were not changed): an option is what did not.
          _error = EditCopy.optionsFailed([for (final id in writes.keys) subjectDisplayName(id)], subjectsSaved: subjectsSaved, offline: e.isOffline);
        } else {
          _error = e.isOffline
              ? EditCopy.subjectsOffline
              : e.kind == ApiErrorKind.validation
                  ? EditCopy.subjectsRejected
                  : EditCopy.subjectsFailed;
        }
      });
    }
  }

  /// Back with unsaved choices asks once.
  Future<void> _askLeave() async {
    final leave = await showMmSheet<bool>(
      context: context,
      title: EditCopy.leaveTitle,
      builder: (sheet) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(EditCopy.leaveBody, style: context.mmType.body),
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: EditCopy.leaveStay, onPressed: () => Navigator.of(sheet).pop(false)),
          const SizedBox(height: MmSpace.s8),
          Align(child: KeyButton.quiet(label: EditCopy.leaveGo, onPressed: () => Navigator.of(sheet).pop(true))),
        ],
      ),
    );
    if (leave != true || !mounted) return;
    setState(() => _leave = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).maybePop();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authSnapshotProvider, _onProfile);
    // The Key cards read holds each subject's saved option; the choice under a row waits for it.
    ref.watch(keyCardsHomeProvider);
    final home = _home;
    final catalog = ref.watch(youSubjectCatalogProvider);
    final loaded = catalog.value;
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    final canSave = _baselineKnown && _changed && _chosen.isNotEmpty && !_saving && !offline;

    return PopScope(
      canPop: _leave || !_changed || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _askLeave();
      },
      child: YouPage(
      title: EditCopy.subjectsTitle,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_cap != null) ...[
            // Plain words, not a boxed alert: refusing a sixth subject is information.
            Semantics(
              liveRegion: true,
              container: true,
              child: MmShake(key: _shake, child: Text(_cap!, style: context.mmType.small.copyWith(color: context.mmColors.ink))),
            ),
            const SizedBox(height: MmSpace.s12),
          ],
          if (_error != null) ...[
            InlineBanner(message: _error!, tone: BannerTone.error),
            const SizedBox(height: MmSpace.s12),
          ],
          if (_savedAt != null) ...[
            ReceiptLine(text: _receipt ?? EditCopy.subjectsSaved(_savedAt!, _chosen.length)),
            const SizedBox(height: MmSpace.s12),
          ],
          KeyButton(
            label: EditCopy.subjectsSave,
            loading: _saving,
            onPressed: canSave ? _save : null,
            disabledReason: _saving || _savedAt != null
                ? null
                : offline
                    ? EditCopy.subjectsOfflineNow
                    : !_baselineKnown
                    ? EditCopy.subjectsProfileLoading
                    : _chosen.isEmpty
                        ? EditCopy.subjectsNeedOne
                        : !_changed
                            ? EditCopy.subjectsUnchanged
                            : null,
          ),
        ],
      ),
      children: [
        // One header block on the page grid: the count and the one-line rule on the left, Mobi on
        // the right edge. No bubble of instructions before the first choice.
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s4, youText, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SlotCount(count: _chosen.length, max: kMaxProfileSubjects),
                    const SizedBox(height: MmSpace.s4),
                    Text(EditCopy.subjectsHint, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
                  ],
                ),
              ),
              YouMobi(size: 64, controller: _mobi, entrance: MobiAct.point),
            ],
          ),
        ),
        if (loaded == null)
          const Padding(padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0), child: _ListSkeleton())
        else ...[
          if (!loaded.fromRegistry)
            const Padding(
              padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
              child: InlineBanner(message: EditCopy.subjectsFallback),
            ),
          ..._stale(loaded),
          for (final group in SubjectGroup.values)
            if (loaded.inGroup(group).isNotEmpty) ...[
              GroupHeading(group.label, top: MmSpace.s24),
              YouPanel(
                flat: true,
                inset: 40 + MmSpace.s12,
                children: [
                  for (final o in loaded.inGroup(group))
                    _withOption(
                      home,
                      o,
                      SubjectChoiceRow(
                        id: o.id,
                        name: o.name,
                        chosen: _chosen.contains(o.id),
                        onTap: _saving ? null : () => _toggle(o.id),
                      ),
                    ),
                ],
              ),
            ],
        ],
      ],
    ));
  }

  /// A chosen subject with options carries its choice under the row (LK94), in the row's own space: the picker lines up
  /// with the name, past the 40 dp object. The row's height eases as it opens and closes.
  Widget _withOption(KcHome? home, SubjectOption o, Widget row) {
    final set = subjectOptionsFor(o.id);
    if (set == null) return row;
    return YouSizeEase(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          row,
          if (home != null && _chosen.contains(o.id))
            Padding(
              padding: const EdgeInsets.only(left: 40 + MmSpace.s12),
              child: SubjectOptionPicker(
                options: set,
                subjectName: o.name,
                value: _shownOption(home, o.id),
                onChanged: _saving ? null : (option) => _pick(o.id, option),
              ),
            ),
        ],
      ),
    );
  }

  /// Chosen subjects practice cannot open (retired, not offered, or unknown to the registry).
  List<Widget> _stale(SubjectCatalog catalog) {
    if (!catalog.fromRegistry) return const [];
    final stale = <SubjectOption>[
      for (final id in _chosen)
        if (catalog.byId(id) case final o?)
          if (!o.supported) o else ...const []
        else
          SubjectOption(id: id, name: subjectDisplayName(id), supported: false),
    ];
    if (stale.isEmpty) return const [];
    return [
      const GroupHeading(EditCopy.staleHeading, top: MmSpace.s24),
      YouPanel(
        flat: true,
        inset: 40 + MmSpace.s12,
        children: [
          for (final o in stale)
            StaleSubjectRow(id: o.id, name: o.name, reason: o.reason, onRemove: _saving ? null : () => _toggle(o.id)),
        ],
      ),
    ];
  }
}

class _ListSkeleton extends StatelessWidget {
  const _ListSkeleton();

  @override
  Widget build(BuildContext context) {
    return SkeletonGroup(
      label: 'Loading subjects',
      child: Column(
        children: [
          for (var i = 0; i < 6; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s12),
            const Row(
              children: [
                Skeleton(width: 40, height: 40, radius: 20),
                SizedBox(width: MmSpace.s12),
                Expanded(child: Skeleton.line(width: 160)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
