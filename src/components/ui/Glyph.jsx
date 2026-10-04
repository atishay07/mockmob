// One icon language for the signed-in product.
//
// Rules: a single family (lucide), one stroke weight, currentColor so every theme works,
// decorative by default (aria-hidden) and labelled only when the icon carries meaning alone.
// Never use emoji or text glyphs (✓ ✗ ★ ▲ ∞) as UI. Add a name here instead.
import {
  Atom, BadgeIndianRupee, BookOpenText, Bookmark, Briefcase, Calculator, CalendarCheck, Check, ChefHat, ChevronDown,
  ChevronUp, X as CloseIcon, CircleCheck, CircleHelp, CircleX, Cpu, Compass, Dna, Dumbbell, FilePlus2, FlaskConical, Globe2, GraduationCap,
  Home, Info, Infinity as InfinityIcon, ListChecks, MonitorCheck, Landmark, Languages, Layers, Leaf, Library, Lightbulb, LogOut, Map, Mic,
  Music, Newspaper, NotebookText, Orbit, Palette, Radar, RefreshCw, Scale, Scroll, ShieldCheck, Telescope, Timer,
  TrendingUp, Trophy, TriangleAlert, UserRound, Users, Wheat, Brain, Ruler, Gavel, Sprout, Lock, Clock, Wallet,
} from 'lucide-react';

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
  prepos: Orbit,
  explore: Telescope,
  ranks: Trophy,
  contribute: FilePlus2,
  uploads: Library,
  moderation: ShieldCheck,
  guide: CircleHelp,
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
 *   practice: a bolt coin  (spent on Quick Practice and Full Mock)
 *   prepos:   an orbit coin (the PrepOS wallet)
 */
export function CreditMark({ kind = 'practice', size = 18, className = '' }) {
  return (
    <svg className={`credit-mark credit-mark--${kind} ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.25" />
      {kind === 'prepos' ? (
        <>
          <ellipse cx="12" cy="12" rx="5.2" ry="2.2" transform="rotate(-28 12 12)" />
          <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
        </>
      ) : (
        <path d="M13 6.75 8.9 12.4h3l-.9 4.85 4.1-5.65h-3z" />
      )}
    </svg>
  );
}

/**
 * Balance display used everywhere a credit amount appears (top bar, practice, wallet).
 *   amount: number | 'unlimited' | null (unknown)
 */
export function CreditAmount({ kind = 'practice', amount, unit = true, size = 16, className = '' }) {
  const unlimited = amount === 'unlimited';
  const unknown = amount === null || amount === undefined;
  const label = unlimited ? 'Unlimited' : unknown ? '—' : Number(amount).toLocaleString('en-IN');
  const noun = kind === 'prepos' ? 'PrepOS credits' : 'practice credits';
  return (
    <span className={`credit-amount credit-amount--${kind} ${className}`} data-state={unlimited ? 'unlimited' : unknown ? 'unknown' : 'known'}
      title={unknown ? `${noun}: unavailable` : unlimited ? `${noun}: included` : `${label} ${noun}`}>
      <CreditMark kind={kind} size={size} />
      <b className="credit-amount__value">{label}</b>
      {unit && !unlimited ? <span className="credit-amount__unit">{kind === 'prepos' ? 'PrepOS' : 'credits'}</span> : null}
      <span className="sr-only">{unknown ? `${noun} unavailable` : unlimited ? `${noun} included` : `${label} ${noun}`}</span>
    </span>
  );
}

const MODE_ICONS = { quick: Timer, full: ListChecks, smart: Brain, nta: MonitorCheck };
export function ModeIcon({ id, size = 20, className = '', ...rest }) {
  const Cmp = MODE_ICONS[id] || Timer;
  return <Cmp size={size} strokeWidth={STROKE} className={className} aria-hidden="true" {...rest} />;
}
