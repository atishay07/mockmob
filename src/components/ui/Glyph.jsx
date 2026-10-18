// One icon language for the signed-in product.
//
// Rules: a single family (lucide), one stroke weight, currentColor so every theme works,
// decorative by default (aria-hidden) and labelled only when the icon carries meaning alone.
// Never use emoji or text glyphs (✓ ✗ ★ ▲ ∞) as UI. Add a name here instead.
import {
  Atom, BadgeIndianRupee, BookOpenText, Bookmark, Briefcase, Calculator, CalendarCheck, Check, ChefHat, ChevronDown,
  ChevronUp, X as CloseIcon, CircleCheck, CircleHelp, CircleX, Cpu, Compass, Dna, Dumbbell, FilePlus2, FlaskConical, Globe2, GraduationCap,
  Home, Info, Infinity as InfinityIcon, LifeBuoy, Mail, ListChecks, MonitorCheck, Landmark, Languages, Layers, Leaf, Library, Lightbulb, LogOut, Map, Mic,
  Music, Newspaper, NotebookText, Palette, Radar, RefreshCw, Scale, Scroll, ShieldCheck, Telescope, Timer,
  TrendingUp, Trophy, TriangleAlert, UserRound, Users, Wheat, Brain, Ruler, Gavel, Sprout, Lock, Clock, Wallet,
} from 'lucide-react';
// The phone dock's Colleges tab and its More key (NAV-1017 section 8).
import { Ellipsis, University } from 'lucide-react';
// Help's question search (W-083), and Ask Mobi's mark (D8: the Orbit read as a "not allowed" sign at 14 px).
import { Search, Sparkles } from 'lucide-react';

const STROKE = 1.75;

const APP_ICONS = {
  today: CalendarCheck,
  practice: Timer,
  learn: BookOpenText,
  recall: Brain,
  review: NotebookText,
  progress: TrendingUp,
  account: UserRound,
  radar: Radar,
  saved: Bookmark,
  compass: Compass,
  prepos: Sparkles,
  explore: Telescope,
  ranks: Trophy,
  mob: Users,
  contribute: FilePlus2,
  uploads: Library,
  moderation: ShieldCheck,
  guide: CircleHelp,
  help: LifeBuoy,
  mail: Mail,
  signout: LogOut,
  home: Home,
  wallet: Wallet,
  pricing: BadgeIndianRupee,
  lock: Lock,
  clock: Clock,
  refresh: RefreshCw,
  expand: ChevronDown,
  collapse: ChevronUp,
  unlimited: InfinityIcon,
  colleges: University,
  more: Ellipsis,
  search: Search,
};

const STATUS_ICONS = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
  hint: Lightbulb,
  check: Check,
  close: CloseIcon,
};

// Every subject id in data/subjects.js, grouped by what the student recognises at a glance.
const SUBJECT_ICONS = {
  english: BookOpenText, hindi: Languages, assamese: Languages, bengali: Languages, gujarati: Languages,
  kannada: Languages, malayalam: Languages, marathi: Languages, odia: Languages, punjabi: Languages,
  tamil: Languages, telugu: Languages, urdu: Languages, sanskrit: Scroll,
  accountancy: Calculator, business_studies: Briefcase, economics: TrendingUp, entrepreneurship: Briefcase,
  mathematics: Ruler, applied_mathematics: Ruler, gat: Layers,
  physics: Atom, chemistry: FlaskConical, biology: Dna, agriculture: Wheat, environmental_studies: Leaf,
  computer_science: Cpu, engineering_graphics: Ruler,
  history: Landmark, political_science: Scale, geography: Map, sociology: Users, psychology: Brain,
  anthropology: Globe2, legal_studies: Gavel, mass_media: Mic, teaching_aptitude: GraduationCap,
  fine_arts: Palette, performing_arts: Music, physical_education: Dumbbell, home_science: ChefHat,
  knowledge_tradition_india: Sprout,
};

export function AppIcon({ name, size = 18, className = '', label, ...rest }) {
  const Cmp = APP_ICONS[name] || CircleHelp;
  return <Cmp size={size} strokeWidth={STROKE} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} {...rest} />;
}

export function StatusIcon({ kind = 'info', size = 16, className = '', label, ...rest }) {
  const Cmp = STATUS_ICONS[kind] || Info;
  return <Cmp size={size} strokeWidth={STROKE} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} {...rest} />;
}

export function SubjectIcon({ id, size = 20, className = '', ...rest }) {
  const Cmp = SUBJECT_ICONS[id] || NotebookText;
  return <Cmp size={size} strokeWidth={STROKE} className={className} aria-hidden="true" {...rest} />;
}

/**
 * The two currencies, drawn as two coins so they are never confused:
 *   practice: a paper coin (spent on Quick practice and Full mock); a small question sheet, never a bolt, so it cannot
 *             read as the retired bolt mark
 *   prepos:   a sparkle coin (the AI wallet; the Ask Mobi row draws the same sparkle). It was an orbit, which at 14 px read as
 *             a circle with a slash, the "not allowed" sign (D8)
 */
export function CreditMark({ kind = 'practice', size = 18, className = '' }) {
  return (
    <svg className={`credit-mark credit-mark--${kind} ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.25" />
      {kind === 'prepos' ? (
        <path className="credit-mark__spark" d="M12 6.2Q12.9 11.1 17.8 12Q12.9 12.9 12 17.8Q11.1 12.9 6.2 12Q11.1 11.1 12 6.2Z" />
      ) : (
        <>
          <rect x="8.6" y="7" width="6.8" height="10" rx="1.3" />
          <path d="M10.6 10.2h2.8M10.6 13.2h2.8" />
        </>
      )}
    </svg>
  );
}

/**
 * Balance display used everywhere a credit amount appears (top bar, practice, wallet).
 *   amount: number | 'unlimited' | null (unknown)
 */
// `display` is what is drawn while a number rolls; the title and the screen-reader text always carry the real amount.
export function CreditAmount({ kind = 'practice', amount, display, unit = true, unitLabel, size = 16, className = '' }) {
  const unlimited = amount === 'unlimited';
  const unknown = amount === null || amount === undefined;
  const label = unlimited ? 'Unlimited' : unknown ? '—' : Number(amount).toLocaleString('en-IN');
  const noun = kind === 'prepos' ? 'AI credits' : 'Practice credits';
  return (
    <span className={`credit-amount credit-amount--${kind} ${className}`} data-state={unlimited ? 'unlimited' : unknown ? 'unknown' : 'known'}
      title={unknown ? `${noun}: unavailable` : unlimited ? `${noun}: included` : `${label} ${noun}`}>
      <CreditMark kind={kind} size={size} />
      <b className="credit-amount__value">{display !== undefined && !unlimited && !unknown ? Number(display).toLocaleString('en-IN') : label}</b>
      {unit && !unlimited ? <span className="credit-amount__unit">{unitLabel || (kind === 'prepos' ? 'AI credits' : 'credits')}</span> : null}
      <span className="sr-only">{unknown ? `${noun} unavailable` : unlimited ? `${noun} included` : `${label} ${noun}`}</span>
    </span>
  );
}

const MODE_ICONS = { quick: Timer, full: ListChecks, smart: Brain, nta: MonitorCheck };
export function ModeIcon({ id, size = 20, className = '', ...rest }) {
  const Cmp = MODE_ICONS[id] || Timer;
  return <Cmp size={size} strokeWidth={STROKE} className={className} aria-hidden="true" {...rest} />;
}
