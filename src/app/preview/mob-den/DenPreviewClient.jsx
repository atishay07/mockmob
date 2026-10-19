"use client";
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import MobPage from '@/components/mob/MobPage';
import DenChains from '@/components/mob/den/DenChains';
import DenShelf from '@/components/mob/den/DenShelf';
import { installDenPreview } from './previewDen';

installDenPreview();

export default function DenPreviewClient() {
  const params = useSearchParams();
  const view = params.get('view') || 'mob';
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: 'Aarav Mehta', email: 'preview@example.test', role: 'student',
      subjects: params.get('den') === 'nosubjects' ? [] : ['accountancy', 'business_studies', 'economics', 'english'], retiredSubjects: [], creditBalance: 0 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), [params]);
  const links = { mob: `/preview/mob-den?${params.toString()}` };
  const body = view === 'chains' || view === 'chains-mob' ? <DenChains user={auth.user} /> : view === 'shelf' ? <DenShelf user={auth.user} /> : <MobPage user={auth.user} />;
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <AppLayoutClient previewRoute="/mob" previewLinks={links} mobEnabled>{body}</AppLayoutClient>
      </RoleProvider>
    </AuthContext.Provider>
  );
}
