import { Globe } from "lucide-react";
import { CURRENCIES, useCurrency } from "../lib/currency.js";

// Display-currency picker. Prices are always charged in INR; this only changes what is shown.
export default function CurrencySwitcher({ className = "" }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <label className={`cm-currency ${className}`.trim()}>
      <Globe size={15} aria-hidden="true" />
      <span className="sr-only">Display currency</span>
      <select
        className="cm-currency-select"
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Display currency"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
        ))}
      </select>
    </label>
  );
}
