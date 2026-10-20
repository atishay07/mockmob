"use client";
import { useAuth } from '@/components/AuthProvider';
import MobPage from '@/components/mob/MobPage';

export default function MobPageClient({ billingOn = false }) {
  const { user } = useAuth();
  return <MobPage user={user} billingOn={billingOn} />;
}
