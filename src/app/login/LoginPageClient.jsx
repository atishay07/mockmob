"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPageClient() {
  const [name, setName] = useState('');

  const handleDemoLogin = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    signIn('credentials', { username: name, callbackUrl: '/onboarding' });
  };

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/onboarding' });
  };

  return (
    <div className="view flex flex-col items-center justify-center min-h-screen px-5">
      <div className="text-center mb-8">
        <Logo className="mb-4" />
        <h1 className="display-lg mb-2">Welcome to the mob.</h1>
        <p className="text-zinc-400">Enter your alias to start grinding.</p>
      </div>

      <div className="glass p-8 w-full max-w-sm">
        <form onSubmit={handleDemoLogin} className="flex flex-col gap-4">
          <div>
            <label className="eyebrow mb-2">Alias (Leaderboard Name)</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. rank_chaser_07" 
              autoFocus 
            />
          </div>
          <Button type="submit" variant="volt" className="w-full justify-center">
            Enter the arena <Icon name="arrow" />
          </Button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <div className="text-xs text-zinc-500 font-mono uppercase tracking-widest">or</div>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <Button onClick={handleGoogleLogin} variant="outline" className="w-full justify-center">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
          </svg>
          Continue with Google
        </Button>
      </div>
      
      <div className="mt-8 text-center text-xs text-zinc-500 max-w-xs">
        <Icon name="shield" style={{ display: 'inline', width: '14px', height: '14px', marginRight: '4px' }} />
        We only store your display name for the leaderboard. No spam ever.
      </div>
    </div>
  );
}
