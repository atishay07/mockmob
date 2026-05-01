"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/AuthProvider';

export default function OnboardingPageClient() {
  const router = useRouter();
  const { user, status, refreshSession } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (user?.subjects?.length > 0 && selected.length === 0) {
      const id = window.setTimeout(() => setSelected(user.subjects), 0);
      return () => window.clearTimeout(id);
    }
  }, [user, selected.length]);

  useEffect(() => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(data => setSubjects((Array.isArray(data) ? data : []).filter((subject) => subject.id !== 'teaching_aptitude')));
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signup');
    } else if (status === 'authenticated') {
      const isEdit = typeof window !== 'undefined' && window.location.search.includes('edit=true');
      // If user already has subjects, go to dashboard
      if (user?.subjects?.length > 0 && !isEdit) {
        router.push('/dashboard');
      }
    }
  }, [status, user, router]);

  const toggleSubject = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id));
    } else if (selected.length < 5) {
      setSelected([...selected, id]);
    }
  };

  const handleContinue = async () => {
    if (selected.length === 0) return;
    if (!user?.id) return;
    
    // Save to user profile
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects: selected })
    });
    
    await refreshSession();
    
    router.push('/dashboard');
  };

  if (status === 'loading' || subjects.length === 0) return <div className="view p-10">Loading...</div>;

  return (
    <div className="view">
      <nav className="p-5 flex justify-between items-center border-b border-white/5">
        <Logo />
        <div className="text-sm font-mono text-zinc-500">Step 1 of 1</div>
      </nav>

      <div className="container-narrow px-5 pt-12 pb-40 text-center">
        <div className="eyebrow mb-3">{'// Build your curriculum'}</div>
        <h1 className="display-md mb-3">What are you <span className="text-volt" style={{ fontStyle: 'italic' }}>targeting?</span></h1>
        <p className="text-zinc-400 mb-10 max-w-md mx-auto">Select up to 5 subjects to tailor your mock test feed and weakness radar.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10 text-left max-w-3xl mx-auto">
          {subjects.map(s => {
            const isSelected = selected.includes(s.id);
            return (
              <button
                type="button"
                key={s.id} 
                className={`subject-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleSubject(s.id)}
                aria-pressed={isSelected}
              >
                <div className="flex justify-between items-start">
                  <div className="glyph">{s.glyph}</div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-volt border-volt' : 'border-white/20'}`}>
                    {isSelected && <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                </div>
                <div className="font-display font-bold text-lg mb-1">{s.name}</div>
                <div className="text-xs text-zinc-500">{s.chapters.length} chapters</div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-5 bg-ink/90 backdrop-blur-md border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 z-50">
          <div className="text-sm text-zinc-400">
            Selected <span className="text-white font-bold">{selected.length}</span> / 5 subjects
          </div>
          <Button 
            variant="volt" 
            size="lg" 
            disabled={selected.length === 0} 
            onClick={handleContinue}
            className="w-full md:w-auto"
          >
            Enter Dashboard <svg className="icon" viewBox="0 0 24 24"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
