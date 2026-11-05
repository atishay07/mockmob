import './plan-stage.css';

// The one plan on its stage (R4-H7 and R4 /pricing, owner LK130 and LK134, 5 Nov 2026): a big word behind the top of the plan
// card, shared by the home page's #pricing and the /pricing checkout, so the two are one card ("refine it to how it is on the
// home page"). The word is decoration (the card's own title and the section heading say the same), so it is hidden from
// assistive technology. `children` is the card (PlanCard with className "plan-glass"). A server component with no state.
export function PlanStage({ word, id, className = '', children }) {
  return (
    <div className={`plan-stage${className ? ` ${className}` : ''}`} id={id}>
      <p className="plan-stage__word" aria-hidden="true">{word}</p>
      {children}
    </div>
  );
}

export default PlanStage;
