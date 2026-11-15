import { permanentRedirect } from 'next/navigation';

// /du-cutoffs/colleges has no page of its own: the college list lives on the cutoffs index.
export default function DuCutoffCollegesPage() {
  permanentRedirect('/du-cutoffs#colleges');
}
