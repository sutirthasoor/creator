// Class strings copied verbatim from the original page markup (Tailwind v4 compiled build).
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const CORE = `whitespace-nowrap font-medium cursor-pointer transition-colors ${FOCUS}`;

// Header CTA: visible on phones too (removed `hidden ... xl:inline-flex`).
export const BTN_PRIMARY_HEADER = `inline-flex items-center justify-center gap-2 ${CORE} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md text-xs master-nav-cta px-4`;

// Currency button kept in case other pages use it, but Header no longer renders it.
export const BTN_CURRENCY = `justify-center ${CORE} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs`;

// Desktop auth buttons: always inline-flex. No responsive visibility gate.
export const BTN_SIGNIN_DESKTOP = `inline-flex items-center justify-center gap-2 ${CORE} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2.5 text-xs min-h-11`;
export const BTN_SIGNUP_DESKTOP = `inline-flex items-center justify-center gap-2 ${CORE} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-2.5 text-xs min-h-11`;

// Mobile auth buttons: only shown below 640px (Header hides them via the parent).
export const BTN_SIGNIN_MOBILE = `inline-flex items-center justify-center gap-2 ${CORE} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs`;
export const BTN_SIGNUP_MOBILE = `inline-flex items-center justify-center gap-2 ${CORE} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs`;

// Hamburger: only shown below 640px now that the top-bar buttons are always visible.
export const BTN_MENU = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors ${FOCUS} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-11 w-11 shrink-0`;

export const BTN_MOBILE_CTA = `inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors ${FOCUS} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 master-nav-cta mt-3 w-full justify-center`;
export const BTN_HERO_CTA = `inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-colors ${FOCUS} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 rounded-md px-8 master-hero-cta`;
export const BTN_FINAL_CTA = `inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-colors ${FOCUS} bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 rounded-md px-8 master-button`;
export const BTN_ICON_OUTLINE = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors ${FOCUS} border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9`;
export const BTN_ICON_GHOST = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors ${FOCUS} hover:bg-accent hover:text-accent-foreground h-9 w-9`;
export const CART_LINK = "relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition hover:border-primary/40 hover:text-primary";