import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';

export function NavBar() {
  const links = [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Leaderboard', href: '/login' },
  ];
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(20px)' }}>
      <div className="container-wide px-5 flex items-center justify-between" style={{ height: '60px' }}>
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
              <Link 
                key={link.label}
                href={link.href}
                className="hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '13px', color: '#a1a1aa' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/signup" className="btn-volt sm">Sign up <span className="ml-2 inline-flex items-center" style={{width: '1em', height: '1em'}}><svg className="icon" viewBox="0 0 24 24"><path d="M7 17L17 7M7 7h10v10"/></svg></span></Link>
        </div>
      </div>
    </nav>
  );
}
