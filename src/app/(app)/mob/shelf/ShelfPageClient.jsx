"use client";
import { useAuth } from '@/components/AuthProvider';
import DenShelf from '@/components/mob/den/DenShelf';

export default function ShelfPageClient() {
  const { user } = useAuth();
  return <DenShelf user={user} />;
}
