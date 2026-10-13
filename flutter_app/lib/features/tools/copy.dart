// Every string the CUET tools show. Labels that come from the website's DU tools are verbatim.

import '../../core/domain/cuet_dates.dart';

abstract final class ToolsCopy {
  // Hub.
  static const hubTitle = 'CUET tools';
  static const hubLead = 'Plan the papers and the courses. Every figure is DU’s own 2026 data.';
  static const compassTitle = 'Admission Compass';
  static const compassQuestion = 'Which DU courses can your subjects get?';
  static const compassHubNote = 'Eligibility under the 2026-27 Bulletin, then college cutoffs by category and round.';
  static const openCompass = 'Open Compass';
  static const comboTitle = 'Combo planner';
  static const comboNote = 'The papers that open the courses you want';
  static const guideTitle = 'CUET 2027 guide';
  static const guideNote = 'Expected dates and a month-by-month plan';
  static const pyqTitle = 'Previous-year questions';
  static const pyqNote = 'How to practise with past papers, on the website';
  static const sourcesTitle = 'Official DU documents';
  static const sourcesNote = 'The Bulletin and the three round lists';
  /// The one source line the tools keep: where every rule and cutoff comes from.
  static const dataLine = 'DU data: CSAS 2026, Rounds I to III, and the UG Bulletin 2026-27.';

  static String hubOpens(int subjects) =>
      'DU programmes your $subjects ${subjects == 1 ? 'subject opens' : 'subjects open'} under the 2026-27 rules.';

  // Compass.
  static const compassLead = 'Tick your CUET subjects. The list updates as you tick.';
  static const programmesOpen = 'DU programmes open to these subjects';
  static const rulesLine = 'Under the UG Bulletin 2026-27 subject rules';
  static const pickSubjects = 'Choose subjects';
  static const editSubjects = 'Edit subjects';
  static const quickStart = 'Quick start';
  static const clearAll = 'Clear all';
  static const emptyHeroTitle = 'Start with your subjects';
  static const emptyHeroBody =
      'Most DU programmes need one language and three domain subjects, or one language, one domain subject and the General Aptitude Test.';
  static const fromSheet = 'Ticked from your sheet. Change them freely here.';
  static String overLimit(int n, int limit) => 'You have picked $n papers. The limit is $limit.';

  static const categoryHeading = 'Category and score';
  static String categorySummary(String category, String? score) =>
      score == null ? '$category. No score yet' : '$category. Score $score';
  static const optional = 'Optional';
  static const category = 'Category';
  static const otherQuota = 'Other quota';
  static const otherQuotaNote = 'Sikh, PwBD, KM, SGC, orphan';
  static const scoreLabel = 'Your programme-specific CUET score';
  static String scoreHelp(String max) =>
      'DU shows this per programme on your CSAS dashboard after results. Before results, enter a target. DU’s 2026 lists run up to $max.';
  static const scoreInvalid = 'Enter a number between 0 and 1000.';
  static const scoreHint = 'Out of 1000';

  static const unlocksHeading = 'Add one subject to open more';
  static String unlockValue(int n) => '+$n';
  static String unlockSemantics(String name, int n) => 'Add $name. Opens $n more ${n == 1 ? 'programme' : 'programmes'}';

  static const all = 'All';
  static const searchProgrammes = 'Search programmes';
  static const sortColleges = 'Most colleges';
  static const sortCutoff = 'Highest cutoff';
  static const sortName = 'A to Z';
  static const onlyClearing = 'Only where my score clears a cutoff';
  static const nothingMatches = 'Nothing matches these filters.';
  static const noneOpenTitle = 'No programme is open to these subjects yet.';
  static const noneOpenLine = 'One more subject can change that. Tap one below.';
  static const noneOpenFar = 'Try a different mix with Edit subjects.';
  static String notEligibleHeading(int n) => 'Not eligible yet ($n)';
  static const notEligibleNote = 'See what each one needs';
  static const nearHide = 'Hide';
  static const nearShow = 'Show';
  static String nearShowAll(int n) => 'Show all $n';
  static const nearShowFewer = 'Show fewer';
  static String nearNearest(int n) => 'The $n nearest to opening';

  static String colleges(int n) => n == 1 ? '1 college' : '$n colleges';
  static const noCutoffList = 'No CUET cutoff list published';
  static String roundOneRange(String category, String low, String high) => 'Round I, $category: $low to $high';
  static const verdictAbove = 'Above every Round I cutoff';
  static const verdictWithin = 'Within the Round I range';
  static const verdictBelow = 'Below every Round I cutoff';
  static const secondaryNote = 'Considered only if seats remain after Combinations I and II';
  static const performanceNote = 'Merit also uses a separate performance or practical test';

  static const practiseHeading = 'Practise these subjects';
  static const loadingTitle = 'Loading DU programmes';
  static const errorTitle = 'We could not load the DU data';
  static const errorBody = 'Check your connection and try again.';
  static const offlineTitle = 'You are offline';
  static const offlineBody = 'Your answers and drafts are saved on this phone.';
  static const tryAgain = 'Try again';

  // Programme.
  static const rulesHeading = 'DU’s eligibility rules, checked against your subjects';
  static const youMeetThis = 'You meet this.';
  static const youMeetSecondary = 'You meet this. Considered only if seats remain after Combinations I and II.';
  static const extraLanguage = 'The Bulletin also requires at least one language from List A.';
  static String eligibleVia(String label) => 'Open to you through $label';
  static const notEligible = 'Not open to these subjects yet';
  static const cutoffsHeading = 'College cutoffs, CSAS 2026';
  static const noCutoffsBody =
      'DU did not publish a CUET cutoff list for this programme in 2026. Its merit combines your CUET score with a separate test.';
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
  static String showMore(int next, int left) => 'Show $next more ($left remaining)';
  static const loadingCutoffs = 'Loading college cutoffs';
  static const cutoffsError = 'We could not load the cutoffs for this programme.';
  static const cutoffsOffline = 'These cutoffs load once with a connection, then stay on this phone.';
  static const scaleNote = 'Minimum allocation scores out of 1000.';
  static const unknownProgramme = 'This programme is not in the 2026 data';
  static const unknownProgrammeBody = 'It may have been renamed. Go back to the list and pick it again.';
  static String categoryNow(String c) => 'Category $c';
  static const change = 'Change';

  // Combo.
  static const comboLead = 'Which subjects should you put on the CUET form?';
  static const targetsHeading = 'Where do you want to go?';
  static String targetsHint(int max, int n) => 'Pick up to $max DU programmes. $n chosen.';
  static const searchAll = 'Search all 73 programmes, e.g. Psychology';
  static const poolHeading = 'Which subjects could you take?';
  static String poolHint(int max, int n, int papers) =>
      'Tick every subject you studied or could prepare, up to $max. $n ticked. We find the best $papers for your goals.';
  static const papersHeading = 'Papers on your form';
  static const resultsHeading = 'Your best combinations';
  static const resultsEmpty = 'Tick a few subjects, or use a quick start, to see combinations.';
  static const checking = 'Checking every combination';
  static const comboError = 'The combinations could not be checked.';
  static String keep(String names, int n) =>
      'Do not drop: $names. Every combination that reaches all your targets uses ${n == 1 ? 'it' : 'them'}.';
  static const bestFit = 'Best fit';
  static String option(int n) => 'Option $n';
  static String papers(int n) => n == 1 ? '1 paper' : '$n papers';
  static const yourTargets = 'Your targets';
  static const allProgrammes = 'All DU programmes';
  static String ofN(int a, int b) => '$a of $b';
  static String needs(String name, String gaps) => '$name needs: $gaps';
  static const meetsEvery = 'Meets every target’s subject rules.';
  static const missesATarget = 'Misses at least one target';
  static const seeInCompass = 'See the programmes and cutoffs';
  static const targetFull = 'Six targets chosen. Remove one to add another.';
  static const poolFull = 'Twelve subjects ticked. Remove one to add another.';
  static const remove = 'Remove';

  // Subject picker.
  static const pickerTitle = 'Your CUET subjects';
  static const finderHint = 'Find your subject, e.g. Informatics Practices';
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
  static const proNotListed = 'Not listed';
  static const proNeedsFull = 'A full four-paper projection is needed to compare.';
  static const proWithin = 'The earliest listed cutoff sits inside your range.';
  static const proNoCutoff = 'DU listed no cutoff for this category.';
  static String proAbove(String by) => 'Your range clears the earliest listed cutoff by $by or more.';
  static String proBelow(String by) => 'Your range is $by or more below the earliest listed cutoff.';
  static const shortlistHeading = 'Your DU shortlist';
  static const shortlistNote = 'Up to 8 programmes and colleges. They stay on this phone.';
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
  static const guideDatesNote = 'Expected ${CuetDates.windowMonth} window until NTA publishes dates';
  static const guidePassed = 'Passed';
  static const guideNow = 'Now';
  static const guideExpected = 'Expected';
  static const guideComingUp = 'Coming up';

  // Sources.
  static const sourcesLead = 'Every eligibility rule and cutoff in Compass comes from these University of Delhi documents.';
}
