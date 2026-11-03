import { notFound } from 'next/navigation';
import PipJourneyLab from './PipJourneyLab';
import '../../brand-pip.css';
import './picker.css';
import './lab.css';

export const metadata = { robots: { index: false, follow: false } };

// Development-only prototype surface for Pip's choreography (prototype skill). Three
// structurally different directions behind the standard picker. Never in production.
export default function PipJourneyPrototype() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PipJourneyLab />;
}
