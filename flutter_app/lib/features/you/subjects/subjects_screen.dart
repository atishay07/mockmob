import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/motion/motion.dart' show MmShake, MmShakeState;
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
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
  String? _error;
  String? _cap;

  /// The cap sentence shakes each time a sixth subject is refused (it is already on screen from
  /// the second refusal on, so the shake is called, not triggered by a rebuild).
  final GlobalKey<MmShakeState> _shake = GlobalKey<MmShakeState>();
  DateTime? _savedAt;
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

  bool get _changed {
    final saved = _saved;
    if (saved == null) return false;
    return _chosen.length != saved.length || _chosen.toSet().difference(saved.toSet()).isNotEmpty;
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
    setState(() {
      _saving = true;
      _error = null;
      _cap = null;
      _savedAt = null;
    });
    try {
      final stored = await ref.read(profileEditorProvider).saveSubjects([..._chosen]);
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saved = [...stored];
        _chosen = [...stored];
        _touched = false;
        _savedAt = ref.read(nowProvider)();
      });
      ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.account);
      // Only after the server stored them: Mobi is proud (a nod under Quiet, nothing under Off).
      // The receipt under the list already says what changes, so he does not say it again.
      _mobi.react(MobiMoments.act(MobiEvent.milestone));
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.isOffline
            ? EditCopy.subjectsOffline
            : e.kind == ApiErrorKind.validation
                ? EditCopy.subjectsRejected
                : EditCopy.subjectsFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authSnapshotProvider, _onProfile);
    final catalog = ref.watch(youSubjectCatalogProvider);
    final loaded = catalog.value;
    final canSave = _baselineKnown && _changed && _chosen.isNotEmpty && !_saving;

    return YouPage(
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
            ReceiptLine(text: EditCopy.subjectsSaved(_savedAt!)),
            const SizedBox(height: MmSpace.s12),
          ],
          KeyButton(
            label: EditCopy.subjectsSave,
            loading: _saving,
            onPressed: canSave ? _save : null,
            disabledReason: _saving || _savedAt != null
                ? null
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
                    SubjectChoiceRow(
                      id: o.id,
                      name: o.name,
                      chosen: _chosen.contains(o.id),
                      onTap: _saving ? null : () => _toggle(o.id),
                    ),
                ],
              ),
            ],
        ],
      ],
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
