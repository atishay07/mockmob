import '../../../core/models/consent.dart';

/// Where the student is on the road to CUET (brief section 11, step 3).
enum Stage {
  classTwelve('Class 12, writing CUET in 2027', 'Class 12, writing in 2027', 2027, boards: true),
  passedTwelve('Passed Class 12, writing in 2027', 'Passed Class 12, writing in 2027', 2027),
  classEleven('In Class 11', 'Class 11, writing in 2028', 2028),
  notSure('Not sure yet', 'Writing in 2027, probably', 2027);

  const Stage(this.option, this.sheetLine, this.cuetYear, {this.boards = false});

  /// The answer as the student reads it.
  final String option;

  /// The line engraved on the sheet.
  final String sheetLine;
  final int cuetYear;

  /// Class 12 boards fall in the plan (mid-February to early April), so it tapers then.
  final bool boards;

  static Stage? byName(String? name) => _byName(values, name);
}

/// What costs the student the most marks, in their words. Each one really changes the first
/// move (directions-final 0.7): its subject or its framing, and Mobi's one line.
enum Worry {
  knewIt('I knew it and still got it wrong', "Knew it and still lost it? That's a trap, not a gap.", 'A trap, not a gap.'),
  time('The last 10 questions, no time left', 'Then we train the clock. Short and often.', 'We train the clock.'),
  numericals('Accounts numericals take me forever', 'Numericals get faster with reps, not with rereading.', 'Reps beat rereading.'),
  passages('English passages eat my time', "Passages reward a method. We'll build yours.", "We'll build a method."),
  syllabus('Too much syllabus, not enough months', 'Then we go in order. One chapter at a time.', 'One chapter at a time.'),
  noIdea('No idea yet, honestly', 'Fair. Ten questions will tell us more than a guess.', 'Ten questions will tell.');

  const Worry(this.option, this.mobiLine, this.mobiShort);

  final String option;

  /// Mobi's one line. Never about the person, only about what happens next.
  final String mobiLine;

  /// The same thought in a few words, for Mobi's bubble in the top bar.
  final String mobiShort;

  static Worry? byName(String? name) => _byName(values, name);
}

/// The study window, as a start time.
enum StudyTime {
  early('Early', 6, 'mornings'),
  afternoon('Afternoon', 17, 'afternoons'),
  evening('Evening', 20, 'evenings'),
  late('Late', 22, 'nights');

  const StudyTime(this.label, this.hour, this.plural);

  final String label;

  /// Start hour, 24 h.
  final int hour;

  /// "4 evenings a week".
  final String plural;

  /// "8:00 PM", with a no-break space so the time never splits across lines.
  String get time {
    final h = hour % 12 == 0 ? 12 : hour % 12;
    return '$h:00\u00A0${hour < 12 ? 'AM' : 'PM'}';
  }

  /// `HH:MM` for the API's study window.
  String get wireStart => '${hour.toString().padLeft(2, '0')}:00';
  String get wireEnd => '${(hour + 1).toString().padLeft(2, '0')}:00';

  static StudyTime? byName(String? name) => _byName(values, name);
}

/// "Are you 18 yet?", held on the phone until sign-in.
enum AgeAnswer {
  adult('Yes', AgeBand.adult),
  minor('Not yet', AgeBand.minor),
  ratherNot('Rather not say', AgeBand.unknown);

  const AgeAnswer(this.label, this.band);

  final String label;

  /// What the consent API is told. "Rather not say" is treated like under 18: usage data off.
  final AgeBand band;

  static AgeAnswer? byName(String? name) => _byName(values, name);
}

T? _byName<T extends Enum>(List<T> values, String? name) {
  for (final v in values) {
    if (v.name == name) return v;
  }
  return null;
}
