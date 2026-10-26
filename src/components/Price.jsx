import { formatMoney, discountPercent } from "../lib/money.js";
import { useCurrency } from "../lib/currency.js";

export default function Price({ price, maxPrice, compareAtPrice, large = false }) {
  useCurrency(); // re-render when the display currency changes
  if (!price) return null;
  const range = maxPrice && Number(maxPrice.amount) > Number(price.amount);
  const off = discountPercent(price, compareAtPrice);
  return (
    <span className={`cm-price${large ? " cm-price-lg" : ""}`}>
      {range && <span className="cm-price-from">From</span>}
      <span className="cm-price-now">{formatMoney(price)}</span>
      {off > 0 && (
        <>
          <s className="cm-price-was" aria-label={`Original price ${formatMoney(compareAtPrice)}`}>{formatMoney(compareAtPrice)}</s>
          <span className="cm-badge cm-badge-sale">{off}% off</span>
        </>
      )}
    </span>
  );
}
