import { Info } from "lucide-react";
import { useCurrency, CURRENCIES, BASE_CURRENCY } from "../lib/currency.js";

// Shown wherever prices appear in a non-INR display currency.
export default function CurrencyNote() {
  const { currency, isBase, live } = useCurrency();
  if (isBase) return null;
  const name = (CURRENCIES.find((c) => c.code === currency) || {}).name || currency;
  return (
    <p className="cm-fineprint cm-currency-note" role="note">
      <Info size={14} aria-hidden="true" /> Prices are shown in {name} ({currency}) for reference
      {live ? " at today’s exchange rate" : " at an approximate rate"}. You will be charged in {BASE_CURRENCY}; your bank
      applies its own rate and fees.
    </p>
  );
}
