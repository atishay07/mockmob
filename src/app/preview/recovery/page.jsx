import { notFound, redirect } from 'next/navigation';
// The Score Recovery Lab now lives inside the result page; its design preview is the Arena result view.
export default function RecoveryDesignPreview(){
  if(process.env.NODE_ENV==='production')notFound();
  redirect('/preview/arena?view=result');
}
