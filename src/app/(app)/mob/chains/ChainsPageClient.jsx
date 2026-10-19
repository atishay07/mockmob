"use client";
import { useAuth } from '@/components/AuthProvider';
import DenChains from '@/components/mob/den/DenChains';

export default function ChainsPageClient() {
  const { user } = useAuth();
  return <DenChains user={user} />;
}
