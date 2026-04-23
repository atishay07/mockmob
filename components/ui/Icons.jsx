import React from 'react';

const icons = {
  bolt: <svg className="icon" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  arrow: <svg className="icon" viewBox="0 0 24 24"><path d="M7 17L17 7M7 7h10v10"/></svg>,
  chevR: <svg className="icon" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>,
  chevL: <svg className="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>,
  play: <svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>,
  check: <svg className="icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>,
  x: <svg className="icon" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  clock: <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  flag: <svg className="icon" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15"/></svg>,
  logout: <svg className="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  upload: <svg className="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  shield: <svg className="icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  trophy: <svg className="icon" viewBox="0 0 24 24"><path d="M6 9a6 6 0 0012 0V3H6v6zM4 22h16M12 15v7"/><path d="M18 5h4v4a4 4 0 01-4 4M6 5H2v4a4 4 0 004 4"/></svg>,
  bar: <svg className="icon" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-6"/></svg>,
  book: <svg className="icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 004 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 016.5 22H20v-5"/></svg>,
  target: <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  trend: <svg className="icon" viewBox="0 0 24 24"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
  flame: <svg className="icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.4-.5-2.3-1.7-3.2-1.3-.9-1.8-2-1.8-2.8C7.5 3.5 12.5 2 14 2c-.5 2 .5 3.5 2 5 1.5 1.5 3 3 3 6 0 4-3.5 7-7 7s-7-2.5-7-6.5"/></svg>,
  users: <svg className="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  radar: <svg className="icon" viewBox="0 0 24 24"><path d="M19.07 4.93a10 10 0 00-14.14 0M16.93 7.07a6 6 0 00-9.86 0M14.82 9.19a2 2 0 00-5.64 0"/><circle cx="12" cy="20" r="2"/></svg>,
  msg: <svg className="icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  route: <svg className="icon" viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15"/><circle cx="18" cy="5" r="3"/></svg>,
  spark: <svg className="icon" viewBox="0 0 24 24"><path d="M12 3l2 7h7l-5.5 4 2 7-5.5-4-5.5 4 2-7L3 10h7z"/></svg>,
  zap: <svg className="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  home: <svg className="icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2h-4V12h-6v10H5a2 2 0 01-2-2z"/></svg>,
  bell: <svg className="icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  alert: <svg className="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
};

export function Icon({ name, className = '', style }) {
  const icon = icons[name];
  if (!icon) return null;
  
  return React.cloneElement(icon, {
    className: `icon ${className}`,
    style
  });
}
