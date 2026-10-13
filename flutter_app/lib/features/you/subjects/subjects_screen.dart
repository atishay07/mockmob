import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/profile_editor.dart';
import '../data/student_target.dart';
import '../data/subject_catalog.dart';
import '../edit_copy.dart';
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
  /// What the account holds (updated after a save).
  late List<String> _saved = _initial();
  late List<String> _chosen = [..._saved];
  bool _saving = false;
  String? _error;
  String? _cap;
  DateTime? _savedAt;
  final MobiController _mobi = MobiController();

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  List<String> _initial() {
    final profile = ref.read(authSnapshotProvider).subjects;
    return profile.isNotEmpty ? [...profile] : [...ref.read(studentTargetProvider).subjects];
  }

  bool get _changed => _chosen.length != _saved.length || _chosen.toSet().difference(_saved.toSet()).isNotEmpty;

  void _toggle(String id) {
    setState(() {
      _error = null;
      _savedAt = null;
      if (_chosen.remove(id)) {
        _cap = null;
        return;
      }
      if (_chosen.length >= kMaxProfileSubjects) {
        // Said once, in the banner; Mobi only shrugs (no second copy of the words).
        _cap = EditCopy.subjectsCap;
        _mobi
          ..hush()
          ..play(MobiAct.oops);
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
        _savedAt = ref.read(nowProvider)();
      });
      // Only after the server stored them: Mobi cheers and says what changes.
      _mobi
        ..play(MobiAct.cheer)
        ..say(EditCopy.subjectsMobiSaved);
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
    final catalog = ref.watch(youSubjectCatalogProvider);
    final loaded = catalog.value;
    final canSave = _changed && _chosen.isNotEmpty && !_saving;

    return YouPage(
      title: EditCopy.subjectsTitle,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_cap != null) ...[
            InlineBanner(message: _cap!, tone: BannerTone.warning),
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
                : _chosen.isEmpty
                    ? EditCopy.subjectsNeedOne
                    : !_changed
                        ? EditCopy.subjectsUnchanged
                        : null,
          ),
        ],
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s4, MmSpace.gutter, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Mobi(pose: MobiPose.point, size: 72, say: EditCopy.subjectsMobi, controller: _mobi),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, MmSpace.s16, MmSpace.gutter, 0),
          child: SlotCount(count: _chosen.length, max: kMaxProfileSubjects),
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
                inset: MmSpace.gutter + 40 + MmSpace.s12,
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
        inset: MmSpace.gutter + 40 + MmSpace.s12,
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
