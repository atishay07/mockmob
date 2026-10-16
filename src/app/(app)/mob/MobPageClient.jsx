"use client";
import { useAuth } from '@/components/AuthProvider';
import MobPage from '@/components/mob/MobPage';

export default function MobPageClient() {
  const { user } = useAuth();
  return <MobPage user={user} />;
}
