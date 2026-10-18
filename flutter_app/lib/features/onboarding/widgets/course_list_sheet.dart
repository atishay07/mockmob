import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../choices_copy.dart';
import '../data/course_combos.dart';
import '../data/du_catalog.dart';

/// "More courses": every course the catalog holds ([DuCatalog.all]), searchable, by the
/// Bulletin's stream, each with its CUET subject combination and its Round 1 college count.
/// Completes with the course the student tapped, or null.
Future<DuCourse?> showCourseList(BuildContext context, {String? selected}) => showMmSheet<DuCourse>(
      context: context,
      title: ChoicesCopy.moreCoursesTitle,
      heightFactor: 0.88,
      builder: (context) => CourseList(selected: selected, onPick: (c) => Navigator.of(context).pop(c)),
    );

/// The list itself (rendered by the goldens without the sheet).
class CourseList extends StatefulWidget {
  const CourseList({super.key, required this.onPick, this.selected});

  final String? selected;
  final ValueChanged<DuCourse> onPick;

  /// The Bulletin's streams in the order the list shows them.
  static const List<String> streams = ['Commerce & Economics', 'Humanities & Social Sciences', 'Science', 'Vocational', 'Other'];

  @override
  State<CourseList> createState() => _CourseListState();
}

class _CourseListState extends State<CourseList> {
  final TextEditingController _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = _query.text.trim().toLowerCase();
    bool hit(DuCourse c) => q.isEmpty || '${c.short} ${c.name}'.toLowerCase().contains(q);
    final children = <Widget>[];
    final streams = [...CourseList.streams, for (final c in DuCatalog.all) if (!CourseList.streams.contains(c.stream)) c.stream];
    var shown = 0;
    for (final stream in streams.toSet()) {
      final rows = [for (final c in DuCatalog.all) if (c.stream == stream && hit(c)) c];
      if (rows.isEmpty) continue;
      shown += rows.length;
      children.add(Padding(
        padding: const EdgeInsets.only(top: MmSpace.s20, bottom: MmSpace.s8),
        child: Semantics(header: true, child: Text(stream.replaceAll('&', 'and'), style: type.label.copyWith(color: colors.ink2))),
      ));
      for (final c in rows) {
        children.add(Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: _CourseRow(course: c, selected: c.id == widget.selected, onTap: () => widget.onPick(c)),
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SearchField(controller: _query, onChanged: (_) => setState(() {})),
        const SizedBox(height: MmSpace.s8),
        Semantics(
          liveRegion: true,
          child: Text(
            shown == 0 ? ChoicesCopy.noCourseMatch(_query.text.trim()) : ChoicesCopy.courseListCount(shown),
            style: type.small.copyWith(color: colors.ink2),
          ),
        ),
        ...children,
      ],
    );
  }
}

class _CourseRow extends StatelessWidget {
  const _CourseRow({required this.course, required this.selected, required this.onTap});

  final DuCourse course;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSelectRow(
      title: course.short,
      note: CourseCombos.line(course),
      selected: selected,
      onTap: onTap,
      trailing: Text(ChoicesCopy.collegesShort(course.collegeCount), style: type.caption.copyWith(color: colors.ink3)),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      cursorColor: colors.ink,
      style: type.body.copyWith(color: colors.ink),
      decoration: InputDecoration(
        hintText: ChoicesCopy.courseSearchHint,
        hintStyle: type.body.copyWith(color: colors.ink3),
        prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink3),
        filled: true,
        fillColor: colors.sunken,
        isDense: true,
        constraints: const BoxConstraints(minHeight: 52),
        contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
        enabledBorder: border(colors.line, 1),
        focusedBorder: border(colors.focusRing, 1.5),
      ),
    );
  }
}
