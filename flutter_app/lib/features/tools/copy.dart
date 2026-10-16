// Every string the CUET tools show. Labels that come from the website's DU tools are verbatim.

import '../../core/copy/copy.dart' show categoryWords, categoryWordsTitle;

/// A category in the words a student says, for the start of a line or a chip: "Unreserved",
/// "OBC", "Single girl child". One mapping with the rest of the app (`categoryWords`).
String categoryLabel(String? category) => categoryWordsTitle(category);

abstract final class ToolsCopy {
  // Hub.
  static const hubTitle = 'CUET tools';
  static const allToolsRow = 'All CUET tools';
  static const allToolsNote = 'Combo Planner, the CUET 2027 exam guide and past papers';
  static String todayCompassNote(int open, int total) => '$open of $total DU programmes open to your subjects';
  static const hubLead = 'Find the DU courses your subjects open, then plan the papers that get you there.';
  static const compassTitle = 'Admission Compass';
  static const compassQuestion = 'Which DU courses do your subjects open?';
  static const compassHubNote = 'Checks your subjects against DU’s 2026-27 rules, then shows every college’s 2026 cutoff for your category.';
  static const openCompass = 'Open Compass';
  static const comboTitle = 'Combo Planner';
  static const comboNote = 'Pick the courses you want and find the papers that open them';
  static const guideTitle = 'CUET 2027 exam guide';
  static const guideNote = 'Expected dates and a month-by-month plan';
  static const pyqTitle = 'Previous-year questions';
  static const pyqNote = 'How to practise with past papers. Opens the website';
  static const sourcesTitle = 'Official DU documents';
  static const sourcesNote = 'The Bulletin and the three round lists';
  /// The one source line the tools keep: where every rule and cutoff comes from.
  static const dataLine = 'DU data: 2026 admission rounds and the UG Bulletin 2026-27.';

  static String hubOfTotal(int total) => 'of $total DU programmes';
  static String hubOpens(int subjects) => 'open to your $subjects ${subjects == 1 ? 'subject' : 'subjects'} under the 2026-27 rules.';

  // Compass.
  static const compassLead = 'Tick your CUET subjects.';
  static const programmesOpen = 'DU programmes open to these subjects';
  static const rulesLine = 'Checked against DU’s 2026-27 subject rules';
  static const pickSubjects = 'Choose subjects';
  static const editSubjects = 'Edit subjects';
  static const quickStart = 'Quick start';
  static const subjectsTapToRemove = 'Tap a subject to take it off.';
  static String showMoreRows(int n) => 'Show $n more';
  static const showFewerRows = 'Show fewer';
  static const clearAll = 'Clear all';
  static const emptyHeroTitle = 'Start with your subjects';
  static const emptyHeroBody =
      'Most DU programmes need one language and three domain subjects, or one language, one domain subject and the General Aptitude Test.';
  static const fromCombo = 'Showing the subjects from Combo Planner. Your own subjects are still saved.';
  static const keepCombo = 'Use these subjects';
  static String overLimit(int n, int limit) => 'You have picked $n papers. The limit is $limit.';

  static const categoryHeading = 'Category and estimate';
  /// The bar under the hero. Without a score it says what a score is for, so it never reads as
  /// a demand; with one it names the score.
  static String categorySummary(String category, String? score) =>
      score == null ? '${categoryLabel(category)}. Your full mocks will show here against each college' : '${categoryLabel(category)}. Your estimate $score of 1000';

  /// The same bar when the student's own mocks add up to a total they can use.
  static String categorySummaryMocks(String category, int total) => '${categoryLabel(category)}. Your latest full mocks: $total of 1000';
  static const optional = 'Optional';
  static const category = 'Category';
  static const otherQuota = 'Other quota';
  static const otherQuotaNote = 'Sikh, PwBD, KM, SGC, orphan';
  static const scoreLabel = 'Your estimate, out of 1000';
  static const scoreWhy = 'Set it against each college’s 2026 Round 1 cutoff.';
  static const scoreHelp = 'Raw marks, out of 1000. A mock total or a target both work.';
  static const fillHeading = 'Or use a score from MockMob';
  static String fillMocks(int total) => 'Latest mocks, $total';
  static String fillMocksNote(List<String> names) => 'Your latest full mock in ${_list(names)}, one language and three domain papers.';
  static String fillProjection(int mid) => 'Practice projection, $mid';
  static const fillProjectionNote = 'The middle of your Compass Pro range.';
  static String fillSemantics(String what, int value) => 'Use $value, $what';
  static const scoreInvalid = 'Enter a number between 0 and 1000.';
  static const scoreHint = 'For example 650';

  static const unlocksHeading = 'Add one subject to open more';
  static String unlockValue(int n) => '+$n';
  static String unlockAdd(String name) => 'Add $name';
  static const unlockNotNow = 'Not now';
  static const couldClearDot = 'Your score could clear a round';
  static const couldClearWord = 'could clear';
  static String ofOpenToYou(int n) => 'of the $n open to you';
  static String couldClearLine(int n, int open) => '$n of $open open programmes could clear at this score';
  static String showProgrammes(int n) => n == 1 ? 'Show 1 programme' : 'Show $n programmes';

  /// What adding a subject opens: the first two programme names, then how many more.
  static String unlockPreview(List<String> names, int total) {
    if (names.isEmpty) return '';
    if (total <= 1 || names.length == 1) return 'Opens ${names.first}.';
    if (total == 2) return 'Opens ${names[0]} and ${names[1]}.';
    return 'Opens ${names[0]}, ${names[1]} and ${total - 2} more.';
  }

  static String unlockSemantics(String name, int n) => 'Add $name. Opens $n more ${n == 1 ? 'programme' : 'programmes'}';

  static const all = 'All';
  static const searchProgrammes = 'Search programmes';
  static const sortColleges = 'Most colleges';
  static const sortCutoff = 'Highest cutoff';
  static const sortName = 'A to Z';
  static const onlyClearing = 'Only where my score clears a cutoff';
  static const nothingMatches = 'Nothing matches these filters.';
  static const noneOpenLine = 'One more subject can change that. Tap one below.';
  static const noneOpenFar = 'Try a different mix with Edit subjects, or let Combo Planner find one.';
  static String notEligibleHeading(int n) => 'Not open yet ($n)';
  static const notEligibleNote = 'What each one still needs';
  static const nearHide = 'Hide';
  static const nearShow = 'Show';
  static String nearShowAll(int n) => 'Show all $n';
  static const nearShowFewer = 'Show fewer';
  static String nearNearest(int n) => 'The $n nearest to opening';

  static String colleges(int n) => n == 1 ? '1 college' : '$n colleges';
  static String collegesUnit(int n) => n == 1 ? 'college' : 'colleges';

  // Compass: best options, the full list and the smaller programmes.
  static const bestHeading = 'Your best options';
  static const bestNote = 'Open to your subjects, with the most colleges first.';
  static const bestNoteScore = 'Where your score could clear a cutoff, with the most colleges first.';
  static String openHeading(int n) => '$n open to you';
  static String allOpenHeading(int n) => 'All $n open to you';
  static const openNote = 'By stream. Updates as you change subjects.';
  static const otherProgrammes = 'Other programmes';
  static const otherProgrammesHide = 'Hide other programmes';
  static const otherProgrammesNote = 'At one or two colleges, or without a CUET cutoff list';
  static String otherProgrammesSemantics(int n, bool open) =>
      '$n other ${n == 1 ? 'programme' : 'programmes'}, at one or two colleges or without a cutoff list. ${open ? 'Hide them' : 'Show them'}';
  static String seeColleges(int n) => 'See all $n college cutoffs';
  static const comboLinkTitle = 'Not sure about your subjects?';
  static const comboLinkNote = 'Combo Planner finds the papers that open the courses you want';
  static const openCombo = 'Open Combo Planner';
  static const planThisCourse = 'Find the papers for this course';
  static const noCutoffList = 'No CUET cutoff list published';
  /// The caption over a cutoff bar; the figures stand under its two ends.
  static String roundOneLabel(String category) => 'Round 1, ${categoryWords(category)}';
  static const addScore = 'Type an estimate';
  static String openProgramme(String name) => 'Open $name colleges';
  static String roundOneRange(String category, String low, String high) => 'Round 1, ${categoryWords(category)}: $low to $high';
  static const verdictAbove = 'Above every Round 1 cutoff';
  static const verdictWithin = 'Within the Round 1 range';
  static const verdictBelow = 'Below every Round 1 cutoff';
  static const secondaryNote = 'Considered only if seats remain after Combinations I and II';
  static const performanceNote = 'Merit also counts a separate performance or practical test';

  static const practiseHeading = 'Practise these subjects';
  static const practiseNote = 'A cutoff is the target. Practice is the part you control.';
  static const loadingTitle = 'Loading DU programmes';
  static const errorTitle = 'We could not load the DU data';
  static const errorBody = 'Check your connection and try again.';
  static const offlineTitle = 'You are offline';
  static const offlineBody = 'Connect to continue. Your subjects are saved on this phone.';
  static const staleOffline = 'You are offline. This is the last DU data this phone loaded.';
  static const staleError = 'We could not refresh the DU data. This is the last copy this phone loaded.';
  static const tryAgain = 'Try again';

  // Programme.
  static const rulesHeading = 'DU’s eligibility rules, checked against your subjects';
  static const youMeetThis = 'You meet this.';
  static const youMeetSecondary = 'You meet this. Considered only if seats remain after Combinations I and II.';
  static const extraLanguage = 'The Bulletin also requires at least one language from List A.';
  static const eligibleTitle = 'Open to you';
  static const notEligible = 'Not open to these subjects yet';
  static const cutoffsHeading = 'College cutoffs, 2026 rounds';
  static const seeCutoffsAnyway = 'See cutoffs anyway';
  static const hideCutoffs = 'Hide cutoffs';
  static const cutoffsNotOpenNote = 'For reference. These subjects do not open this programme yet.';
  static const noCutoffsBody =
      'DU did not publish a CUET cutoff list for this programme in 2026. Its merit combines CUET marks with a separate test.';
  static const notesHeading = 'Notes from the DU Bulletin';
  static const searchColleges = 'Find a college';
  static const sortFit = 'Seats you clear first';
  static const sortHigh = 'Highest first';
  static const sortLow = 'Lowest first';
  static const sortCollegeName = 'A to Z';
  static const noCollegeMatch = 'No college matches that search.';
  static String clearing(String score, int n, int total) =>
      'A score of $score was at or above a published 2026 cutoff in $n of $total college entries.';
  static const viaUr = 'Cleared on the Unreserved cutoff, which is lower';
  static const viaUrBadge = 'Unreserved';
  static String showMore(int next, int left) => 'Show $next more ($left remaining)';
  static const loadingCutoffs = 'Loading college cutoffs';
  static const cutoffsError = 'We could not load the cutoffs for this programme.';
  static const cutoffsOffline = 'These cutoffs load once with a connection, then stay on this phone.';
  static const scaleNote = 'Minimum allocation scores out of 1000.';
  static const unknownProgramme = 'This programme is not in the 2026 data';
  static const unknownProgrammeBody = 'It may have been renamed. Go back to the list and pick it again.';
  static String categoryNow(String c) => 'Category: ${categoryWords(c)}';
  static const change = 'Change';

  // Combo.
  static const comboLead = 'Which subjects should you put on the CUET form?';
  static const targetsHeading = 'Where do you want to go?';
  static String targetsHint(int max, int n) => 'Pick up to $max DU programmes. $n chosen.';
  static const searchAll = 'Search all 73 programmes, for example Psychology';
  static const poolHeading = 'Which subjects could you take?';
  static String poolHint(int max, int n, int papers) =>
      'Tick every subject you studied or could prepare, up to $max. $n ticked. We find the best $papers for your targets.';
  static const papersHeading = 'Papers on your form';
  static const resultsHeading = 'Your best combinations';
  static const resultsEmpty = 'Tick a few subjects, or use a quick start, to see combinations.';
  static const checking = 'Checking every combination';
  static const comboError = 'The combinations could not be checked.';
  static String keep(String names, int n) =>
      'Do not drop: $names. Every combination that reaches all your targets uses ${n == 1 ? 'it' : 'them'}.';
  static const keepHeading = 'Keep these';
  static String keepReason(String subject, String? lostTarget, int fewer, bool nothing) {
    if (nothing) return '$subject: without it, no programme opens. Every one needs it in some form.';
    final more = fewer > 0 ? '$fewer fewer DU ${fewer == 1 ? 'programme opens' : 'programmes open'}' : 'the same number of DU programmes open';
    if (lostTarget != null) return '$subject: without it, $lostTarget closes and $more.';
    return '$subject: without it, $more.';
  }

  static const bestFit = 'Best fit';
  static String option(int n) => 'Option $n';
  static String papers(int n) => n == 1 ? '1 paper' : '$n papers';
  static const yourTargets = 'Your targets';
  static const allProgrammes = 'All DU programmes';
  static String ofN(int a, int b) => '$a of $b';
  static String needs(String name, String gaps) => '$name needs: $gaps';
  static const meetsEvery = 'Meets every target’s subject rules.';
  static const missesATarget = 'Misses at least one target';
  static const seeInCompass = 'See the courses and cutoffs';
  static const targetFull = 'Six targets chosen. Remove one to add another.';
  static const poolFull = 'Twelve subjects ticked. Remove one to add another.';
  static const remove = 'Remove';

  // Subject picker.
  static const pickerTitle = 'Your CUET subjects';
  static const finderHint = 'Find a subject';
  static const languages = 'Language';
  static const languagesNote = 'List A, at least one';
  static const domains = 'Domain subjects';
  static const domainsNote = 'List B';
  static const aptitude = 'Aptitude';
  static const gat = 'General Aptitude Test';
  static String aliasNote(String hit, String name) => '$hit is counted as $name. NTA and DU treat these papers as one subject.';
  static String noSubjectMatch(String q) => 'No CUET subject matches “$q”. Try the name on your Class 12 marksheet.';
  static String selectedCount(int n) => '$n selected';
  static const done = 'Done';

  // Compass Pro (shown only to an account the server lets read it).
  static const proHeading = 'Practice projection';
  static const proLead = 'What each paper would be worth if exam day went like your practice so far.';
  static String proRange(int low, int high) => 'Range $low to $high';
  static const proTotalComplete = 'Your strongest language and three domain papers';
  static String proTotalPartial(int n) => 'From $n of 4 papers. Practise more subjects for a full total.';
  static String proNoneReady(int min) => 'Practise at least $min questions in a subject to project its paper.';
  static String proPaperMeta(int n, int accuracy, int attempted) => '$n questions, $accuracy% accuracy, $attempted% attempted';
  static String proThin(int needed) => 'Practise $needed more ${needed == 1 ? 'question' : 'questions'} to project this paper';
  static const proNextHeading = 'Next move';
  static String proNextLead(String name, int open, int max) => '$name has the most room: $open of $max marks are still open in your practice.';
  static String proNextChapter(String chapter, int wrong, int blank, int n) => 'Start with $chapter: $wrong wrong and $blank blank in $n questions.';
  static String proPractise(String name) => 'Practise $name';
  static const proUnavailable = 'Compass Pro could not read your record just now.';
  static const proReading = 'Reading your practice record';
  static const proNeedsFull = 'A full four-paper projection is needed to compare.';
  static const proWithin = 'The earliest listed cutoff sits inside your range.';
  static const proNoCutoff = 'DU listed no cutoff for this category.';
  static String proAbove(String by) => 'Your range clears the earliest listed cutoff by $by or more.';
  static String proBelow(String by) => 'Your range is $by or more below the earliest listed cutoff.';
  static const shortlistHeading = 'Your DU shortlist';
  static const shortlistNote = 'Up to 8 programmes and colleges.';
  static const shortlistAdd = 'Add a target';
  static const shortlistEmpty = 'Add the colleges you are aiming for to set them against your projection.';
  static const shortlistFull = 'Your shortlist is full. Remove a target to add another.';
  static const shortlistChooseProgramme = 'Choose a programme';
  static const shortlistChooseCollege = 'Choose a college';
  static const shortlistNoEligible = 'Tick your subjects first. The programmes they open are the ones you can add.';
  static String shortlistRemove(String college) => 'Remove $college from your shortlist';

  // CUET 2027 guide.
  static const guidePageTitle = 'CUET 2027';
  static const guideCommonQuestions = 'Common questions';
  static const guidePassed = 'Passed';
  static const guideNow = 'Now';
  static const guideExpected = 'Expected';
  static const guideComingUp = 'Coming up';
  static const guideBasis = 'Dates after Now are expected, based on the 2026 cycle.';

  // Sources.
  static const sourcesLead = 'Every eligibility rule and cutoff in Compass comes from these University of Delhi documents.';

  /// "English", "English and Hindi", "English, Accountancy and Economics".
  static String _list(List<String> names) => switch (names.length) {
        0 => '',
        1 => names.first,
        _ => '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}',
      };
}

/// The Combo planner's words about one result, from real counts only.
abstract final class ComboWords {
  /// What Mobi's one line says once a plan lands, from the best combination: all targets met,
  /// some met (naming the first missed target), or none (what the nearest still needs).
  static String reaction({required int met, required int targets, String? missedName, String? needs}) {
    if (targets <= 0) return '';
    if (met >= targets) return targets == 1 ? 'These subjects open your target.' : 'These subjects open all $targets of your targets.';
    if (met > 0) return 'The best fit opens $met of $targets targets.${missedName == null ? '' : ' $missedName is the one still missing.'}';
    return 'None of your $targets targets opens yet.${needs == null || needs.isEmpty ? '' : ' The nearest combination still needs $needs.'}';
  }

  static String _count(int n, String one, String many) => '$n ${n == 1 ? one : many}';

  /// "Compared with best: 1 fewer target, 5 more programmes, 1 more paper." Each part is the
  /// real difference between the two combinations; nothing is predicted.
  static String comparedWithBest({
    required int targetsMet,
    required int bestTargetsMet,
    required int programmes,
    required int bestProgrammes,
    required int papers,
    required int bestPapers,
    required bool hasTargets,
  }) {
    final parts = <String>[];
    void part(int diff, String one, String many) {
      if (diff == 0) return;
      parts.add('${diff.abs()} ${diff < 0 ? 'fewer' : 'more'} ${diff.abs() == 1 ? one : many}');
    }

    if (hasTargets) part(targetsMet - bestTargetsMet, 'target', 'targets');
    part(programmes - bestProgrammes, 'programme', 'programmes');
    part(papers - bestPapers, 'paper', 'papers');
    if (parts.isEmpty) return 'Compared with best: the same ${hasTargets ? 'targets, ' : ''}programmes and papers.';
    return 'Compared with best: ${parts.join(', ')}.';
  }

  static const rankRule = 'Ranked by targets opened, then all programmes opened, then fewest papers.';

  /// With no targets chosen the first step of the ranking does not apply.
  static const rankRuleNoTargets = 'Ranked by all programmes opened, then fewest papers.';
  static const expand = 'Show how it compares';
  static const collapse = 'Hide the comparison';

  static String papersUsed(int used, int limit) => '${_count(used, 'paper', 'papers')} in the best combination, of $limit allowed';
}
