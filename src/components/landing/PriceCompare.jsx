import { PRICE_COMPARISON, sourceHost } from '@/../data/price_comparison_1105.mjs';
import { rupees } from '@/lib/payments/value.mjs';
import { COMPARE_COPY } from './homeCopy.mjs';

// What Pro costs to CUET, next to what other CUET prep lists over the same months (R3-D8, owner LK111, 5 Nov 2026: "show that on
// platform X you pay 5,500 for this. Meanwhile on our platform, you say this much"). Honest money (owner UI standards, spec R3):
// one period for every row (to the CUET month), MockMob's total worked out from the offer (value.mjs proToExam, `pro`), each
// rival price as listed on its own page on the read date (data/price_comparison_1105.mjs) with the date under the table and the
// sources in a disclosure; never "cheapest", no MRP, no struck price. Rows say what each includes, so a total is never read alone.
// A server component.

export function PriceCompare({ pro }) {
  const { rows, readOnLabel } = PRICE_COMPARISON;
  const titleId = 'lp-cmp-title';
  return (
    <div className="lp-cmp">
      <h3 className="lp-cmp__title" id={titleId}>{COMPARE_COPY.title(pro.to)}</h3>
      <table className="lp-cmp__table" aria-labelledby={titleId}>
        <thead className="lp-sr">
          <tr><th scope="col">Plan</th><th scope="col">Price</th></tr>
        </thead>
        <tbody>
          <tr data-pro="">
            <th scope="row"><b>{COMPARE_COPY.pro}</b><span>{COMPARE_COPY.proGets(pro)}</span></th>
            <td><b>{pro.total}</b><span>{COMPARE_COPY.proTerm(pro)}</span></td>
          </tr>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row"><b>{row.what}</b><span>{row.gets}</span></th>
              <td><b>{rupees(row.pricePaise)}</b><span>{row.term}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lp-cmp__note">{COMPARE_COPY.note(readOnLabel)}</p>
      <details className="lp-cmp__sources">
        <summary>{COMPARE_COPY.sources}</summary>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>{COMPARE_COPY.source({ row, price: rupees(row.pricePaise), host: sourceHost(row.url), date: readOnLabel })}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default PriceCompare;
