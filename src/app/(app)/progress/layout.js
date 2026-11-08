// The Progress page is also drawn inside the Arena preview's client component, so its document title lives here, not in page.jsx
// (R8 TOOLS-11: every Arena tab names its place).
export const metadata = {
  title: 'Progress | MockMob',
  description: 'Your study days, recovery checks and exam playbook.',
};

export default function ProgressLayout({ children }) {
  return children;
}
