// Every string of "My colleges", in one place. The words match the website's list
// (src/lib/colleges/model.mjs): the same list, the same limits, the same lines.

import '../../../core/models/my_colleges.dart';

abstract final class MyCollegesCopy {
  static const String title = 'My colleges';
  static const String sheetTitle = 'My colleges';

  /// "3 of 8 colleges".
  static String count(int n) => '$n of ${MyColleges.maxColleges} colleges';

  static const String lede = 'The same list on the website. Today shows the 3 that need the most marks, and lists every one under See all.';

  static const String empty = 'No colleges yet. Add the ones you are aiming for and they show on Today, in Compass and on the website.';
  static const String add = 'Add a college';
  static const String choose = 'Choose colleges';
  static const String change = 'Change';
  static const String done = 'Done';

  /// A college row's key in a cutoff list.
  static const String addToList = 'Add to my colleges';
  static const String inList = 'In My colleges';
  static const String listFull = 'My colleges is full';

  static String more(int n) => '$n more on My colleges';

  static String position(int n, String college, String programme) => programme.isEmpty ? 'Choice $n, $college' : 'Choice $n, $college, $programme';
  static String moveUp(String college) => 'Move $college up';
  static String moveDown(String college) => 'Move $college down';
  static String remove(String college) => 'Remove $college from My colleges';
  static String addCollege(String college) => 'Add $college to My colleges';

  static const String loading = 'Loading your colleges';

  // Honest states. Nothing here says the list is empty when it simply did not load.
  static const String failed = 'Your colleges did not load.';
  static const String failedOffline = 'You are offline, so your colleges did not load.';
  static const String staleOffline = 'You are offline. This is the list saved on this phone.';
  static const String staleError = 'Could not refresh just now. This is the list saved on this phone.';
  static const String tryAgain = 'Try again';
  static const String signedOut = 'Sign in to keep a list of colleges.';

  // A change that did not save.
  static const String fullLine = 'My colleges is full at ${MyColleges.maxColleges}. Remove one to add another.';
  static const String offlineSave = 'You are offline, so that change was not saved.';
  static const String signInAgain = 'Sign in again to save your colleges.';
  static const String slowDown = 'Too many changes just now. Wait a minute and try again.';
  static const String saveFailed = 'Could not save your colleges just now. Try again.';

  // The chooser.
  static const String chooseProgramme = 'Choose a programme';
  static const String chooseCollege = 'Choose a college';
  static const String searchProgrammes = 'Search programmes';
  static const String searchColleges = 'Search colleges';
  static const String nothingMatches = 'Nothing matches that.';
  static const String back = 'Back to My colleges';
  static const String backToProgrammes = 'Back to programmes';
  static const String alreadyAdded = 'Already in My colleges';
  static const String programmesFailed = 'The programmes did not load.';
  static const String programmesOffline = 'You are offline, so the programmes did not load.';
  static const String collegesFailed = 'The colleges did not load.';
  static const String collegesOffline = 'You are offline, so the colleges did not load.';
  static const String loadingProgrammes = 'Loading programmes';
  static const String loadingColleges = 'Loading colleges';

  // Today's rung, when no Round 1 figure is on file for a college.
  static const String noFigure = 'No Round 1 figure on file';
}
