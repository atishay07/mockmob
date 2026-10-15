import React from 'react';
import { Icon } from '@/components/ui/Icons';

function CostValue({ value, pro = false }) {
  if (value === true) {
    return (
      <span className="mm-cmp__yes">
        <Icon name="check" aria-hidden="true" />
        Included
      </span>
    );
  }
  if (value === false) return <span className="mm-cmp__no">Not included</span>;
  return <span data-pro={pro ? 'true' : 'false'}>{value}</span>;
}

// Free and Pro, line by line (web IA plan 4.4). `groups` comes from buildCostGroups(): costs are the
// numbers in data/plan_facts.mjs, so this table cannot disagree with the plan cards or the app.
export function CostTable({ groups }) {
  return (
    <div className="mm-cmp">
      <div className="mm-cmp__head" role="presentation">
        <div>Feature</div>
        <div>Free</div>
        <div>Pro</div>
      </div>
      {groups.map((group) => (
        <React.Fragment key={group.heading}>
          <h3 className="mm-cmp__group">{group.heading}</h3>
          {group.rows.map(([feature, free, pro, marker]) => (
            <div key={feature} className="mm-cmp__row" data-popular={marker === 'popular' ? 'true' : 'false'}>
              <div className="mm-cmp__feature">{feature}</div>
              <div className="mm-cmp__cell" data-label="Free">
                <CostValue value={free} />
              </div>
              <div className="mm-cmp__cell" data-label="Pro">
                <CostValue value={pro} pro />
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
