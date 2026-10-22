import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/* Labelled form row with accessible error / hint wiring. */
export function Field({ id, label, optional, error, hint, children }) {
  return (
    <div className="cm-field">
      <label htmlFor={id} className="cm-label">
        {label}
        {optional && <span className="cm-optional"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="cm-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="cm-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

export function describedBy(id, { error, hint }) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

/* Text input with an optional leading icon. */
export function TextInput({ id, icon: Icon, error, hint, ...rest }) {
  return (
    <div className="cm-input-wrap">
      {Icon && <Icon className="cm-input-icon" size={17} aria-hidden="true" />}
      <input
        id={id}
        className={`cm-input${Icon ? " has-icon" : ""}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        {...rest}
      />
    </div>
  );
}

/* Password input with a show / hide toggle. */
export function PasswordInput({ id, icon: Icon, error, hint, ...rest }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="cm-input-wrap">
      {Icon && <Icon className="cm-input-icon" size={17} aria-hidden="true" />}
      <input
        id={id}
        type={shown ? "text" : "password"}
        className={`cm-input has-toggle${Icon ? " has-icon" : ""}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, { error, hint })}
        {...rest}
      />
      <button
        type="button"
        className="cm-pw-toggle"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
