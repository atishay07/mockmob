import '../../../core/router/routes.dart';

/// Practice's three doors (19 Oct PM, owner D126, Practice C): Practise (the subjects, the ways to
/// practise, up next, Ask Mobi and the rows a student looks for), Your papers (the Review screen,
/// D105) and Learn (the lesson library, D20). The switch under the title chooses one; the page's
/// address says which ([AppRoutes.practiceDoorParam]), so a tab switch, a Back and a link all land
/// on the door the student last chose in this session.
enum PracticeDoor {
  practise(null),
  papers('papers'),
  learn('learn');

  const PracticeDoor(this.param);

  /// The value of `?door=` (none for Practise, the default door).
  final String? param;

  /// The door a `?door=` value names; Practise for anything else.
  static PracticeDoor parse(String? value) => switch (value) {
    'papers' => PracticeDoor.papers,
    'learn' => PracticeDoor.learn,
    _ => PracticeDoor.practise,
  };

  /// Where this door lives: `/practice`, `/practice?door=papers`, `/practice?door=learn`.
  String get location => param == null ? AppRoutes.practice : AppRoutes.practiceDoorLocation(param!);
}
