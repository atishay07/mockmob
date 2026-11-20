'use client';

// Section 3 of /home-next: "Your whole CUET prep, in one place." ONE product frame and the four parts of MockMob beside it
// (above it on a phone, as four chips): Practise, See, Fix, Aim. The frame cross-fades to the part's screen, which plays its
// short demo (PrepScreens.jsx). The rows, the autoplay and the keys are AutoFrame's. Under the frame, one "Sign up free"
// (Revision 2, LK83): the shared way in, which a signed-in student sees as their way back to Practice.
import { BrandIcon } from '@/components/brand/BrandIcon';
import { LandingActions } from '@/components/LandingActions';
import AutoFrame from './AutoFrame';
import { PARTS } from './homeNextCopy.mjs';
import { PREP_SCREENS } from './PrepScreens';

export default function PrepFrame({ aim = null, price = null }) {
  return (
    <AutoFrame
      id="hn-prep"
      className="hn-prep"
      label="The four parts of MockMob"
      items={PARTS}
      path={(part) => part.path}
      mark={(part) => <BrandIcon name={part.icon} size={40} className="hn-tab__icon" loading="eager" fetchPriority="low" />}
      screen={(part) => {
        const Screen = PREP_SCREENS[part.id];
        return <Screen aim={aim} price={price} />;
      }}
      after={<div className="hn-after hn-after--key"><LandingActions mode="primary" /></div>}
    />
  );
}
