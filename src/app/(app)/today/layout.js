// Today's page is a client component, so its document title lives here (R8 TOOLS-11: every Arena tab names its place).
export const metadata = {
  title: 'Today | MockMob',
  description: 'Your next move, this week and your road to CUET.',
};

export default function TodayLayout({ children }) {
  return children;
}
