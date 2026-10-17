import { redirect } from 'next/navigation';

// The app's Review again run (a repaired mistake answered before the key shows) is a source of Revise now (LEARN-REVIEW-1017
// 5.8). The old link keeps working and opens Revise on those mistakes alone.
export default function ReviewAgain() {
  redirect('/review/revise?source=again');
}
