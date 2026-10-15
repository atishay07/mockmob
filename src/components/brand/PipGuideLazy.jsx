'use client';

import dynamic from 'next/dynamic';

// The landing's flying Mobi (PipGuide) draws nothing on the server or on the first client render: his flyer
// mounts only after he has measured the page. So his code can arrive after hydration, in its own chunk,
// with no change to what the page shows, and the first download stays smaller.
const PipGuide = dynamic(() => import('./PipGuide'), { ssr: false });

export default PipGuide;
