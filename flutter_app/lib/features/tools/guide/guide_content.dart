// The CUET 2027 guide's facts, from the website's `/cuet-2027` page (and the Class 12 board
// window the app already uses). Nothing for 2027 is confirmed: every date is "expected" until
// NTA publishes the bulletin. Update this file the day it does.

import '../../../core/domain/cuet_dates.dart';

class GuideMilestone {
  const GuideMilestone({required this.when, required this.title, required this.body, required this.start, required this.end, this.expected = false});

  final String when;
  final String title;
  final String body;

  /// The window, used only to mark what has passed and what is now.
  final DateTime start;
  final DateTime end;

  /// Not announced yet.
  final bool expected;
}

final List<GuideMilestone> guideTimeline = [
  GuideMilestone(
    when: 'September to December 2026',
    title: 'Baseline',
    body: 'Finish the NCERT baseline alongside boards prep, and run one short timed drill per subject each week to build format familiarity early.',
    start: DateTime(2026, 9),
    end: DateTime(2027),
  ),
  GuideMilestone(
    when: 'January to February 2027',
    title: 'More timed practice',
    body: 'Add more timed practice as your syllabus coverage grows. Review incorrect and skipped answers, then choose a chapter or question pattern to revisit.',
    start: DateTime(2027),
    end: DateTime(2027, 3),
  ),
  GuideMilestone(
    when: CuetDates.registrationMonths,
    title: 'CUET registration',
    body: 'Fill in the form and choose your papers once NTA opens registration.',
    start: DateTime(2027, 2),
    end: DateTime(2027, 4),
    expected: true,
  ),
  GuideMilestone(
    when: 'Mid-February to early April 2027',
    title: 'Class 12 boards',
    body: 'Boards and CUET prep share these months. Keep the drills short and steady.',
    start: DateTime(2027, 2, 15),
    end: DateTime(2027, 4, 10),
    expected: true,
  ),
  GuideMilestone(
    when: 'May 2027',
    title: 'The exam',
    body: 'Practise with timed papers and keep a block for targeted chapter review.',
    start: DateTime(2027, 5),
    end: DateTime(2027, 6),
    expected: true,
  ),
  GuideMilestone(
    when: 'Late June or early July 2027',
    title: 'Results, then counselling',
    body: 'Results, then university counselling such as DU CSAS.',
    start: DateTime(2027, 6, 20),
    end: DateTime(2027, 8),
    expected: true,
  ),
];

class GuideSection {
  const GuideSection(this.heading, this.body);

  final String heading;
  final List<String> body;
}

const guideIntro = 'The 2027 dates and rules are not out yet.';

const guidePattern = GuideSection('Exam pattern', [
  'Papers, duration and question rules are not confirmed. The latest completed cycle is the best guide to the preparation to expect.',
]);

const guideSubjects = GuideSection('Choosing your five subjects', [
  'Work backwards from the course and check each university’s current eligibility rules before choosing papers. Programme requirements differ.',
]);

const List<(String, String)> guideFaqs = [
  (
    'When will CUET 2027 be held?',
    'NTA has not announced 2027 dates yet. Based on the 2026 cycle, the exam is expected in May 2027 with registration around ${CuetDates.registrationMonths}.',
  ),
  (
    'How many subjects can I take in CUET 2027?',
    'The 2027 subject-selection rules have not been published. CUET UG 2026 allowed up to 5. Check the official bulletin when it is released and confirm programme-specific requirements with each university.',
  ),
  (
    'Is CUET 2027 online or offline?',
    'NTA has not confirmed the 2027 delivery format.',
  ),
  (
    'What is the CUET marking scheme?',
    'The 2027 marking scheme has not been announced. Check the official bulletin before using a historical marking scheme to calculate practice scores.',
  ),
  (
    'When should I start preparing for CUET 2027?',
    'Start with the subjects and syllabus that apply to your target programmes. Add timed practice as you cover topics, then update your plan when NTA and universities publish the 2027 details.',
  ),
];
