import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import {
  Mail, Lock, User, Phone, BookOpen, Receipt, ShieldCheck,
  ArrowRight, ArrowLeft, Info, CircleAlert, CircleCheck, Crown, KeyRound,
} from "lucide-react";
import { Field, TextInput, PasswordInput } from "../components/Field.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { AUTH_NOT_CONNECTED } from "../lib/config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,16}$/;

const COPY = {
  signin: {
    title: "Welcome back",
    sub: "Sign in to see your orders and open your Masterbook.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your account",
    sub: "Keep your orders and Masterbook access in one place.",
    submit: "Create account",
  },
  forgot: {
    title: "Reset your password",
    sub: "Enter the email on your account and we’ll send reset instructions.",
    submit: "Send reset link",
  },
};

function validate(mode, v) {
  const e = {};
  if (mode === "signup" && v.name.trim().length < 2) e.name = "Enter your full name.";
  if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (mode === "signup" && v.phone.trim() && !PHONE_RE.test(v.phone.trim())) {
    e.phone = "Enter a valid mobile number, or leave it blank.";
  }
  if (mode !== "forgot") {
    if (!v.password) e.password = mode === "signup" ? "Choose a password." : "Enter your password.";
    else if (mode === "signup" && v.password.length < 8) e.password = "Use at least 8 characters.";
  }
  if (mode === "signup") {
    if (v.confirm !== v.password) e.confirm = "Passwords do not match.";
    if (!v.terms) e.terms = "Please accept the policies to continue.";
  }
  return e;
}

// Shopify wants E.164 numbers. Ten bare digits are treated as an Indian mobile number.
function toE164(raw) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

const FIELD_ORDER = ["name", "email", "phone", "password", "confirm", "terms"];

/* ---------------- email + password forms (classic mode, or Shopify not connected) ---------------- */

function PasswordForm({ mode, returnTo }) {
  const navigate = useNavigate();
  const { signInWithPassword, register, recover } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  const set = (key) => (ev) => {
    const value = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function onSubmit(ev) {
    ev.preventDefault();
    const errs = validate(mode, values);
    setErrors(errs);
    setNotice(null);
    const firstKey = FIELD_ORDER.find((k) => errs[k]);
    if (firstKey) {
      document.getElementById(`${mode}-${firstKey}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const email = values.email.trim();
      if (mode === "signin") {
        await signInWithPassword({ email, password: values.password });
        navigate(returnTo, { replace: true });
      } else if (mode === "signup") {
        await register({ name: values.name.trim(), email, phone: toE164(values.phone), password: values.password });
        navigate(returnTo, { replace: true });
      } else {
        await recover(email);
        setNotice({ kind: "success", text: "If an account exists for that email, a reset link is on its way." });
      }
    } catch (err) {
      if (err && err.code === AUTH_NOT_CONNECTED) {
        setNotice({
          kind: "info",
          text: "Customer accounts aren’t switched on yet, so nothing was submitted. Add your Shopify settings to .env to enable sign-in.",
        });
      } else {
        setNotice({ kind: "error", text: (err && err.message) || "Something went wrong. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  const id = (k) => `${mode}-${k}`;
  const NoticeIcon = notice?.kind === "error" ? CircleAlert : notice?.kind === "success" ? CircleCheck : Info;

  return (
    <form className="cm-form" onSubmit={onSubmit} noValidate aria-labelledby="auth-title">
      {mode === "signup" && (
        <Field id={id("name")} label="Full name" error={errors.name}>
          <TextInput id={id("name")} icon={User} name="name" autoComplete="name" placeholder="Your name" value={values.name} onChange={set("name")} error={errors.name} />
        </Field>
      )}

      <Field id={id("email")} label="Email address" error={errors.email}>
        <TextInput id={id("email")} icon={Mail} type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={values.email} onChange={set("email")} error={errors.email} />
      </Field>

      {mode === "signup" && (
        <Field id={id("phone")} label="Mobile number" optional error={errors.phone}>
          <TextInput id={id("phone")} icon={Phone} type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={values.phone} onChange={set("phone")} error={errors.phone} />
        </Field>
      )}

      {mode !== "forgot" && (
        <Field id={id("password")} label="Password" error={errors.password} hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <PasswordInput
            id={id("password")}
            icon={Lock}
            name="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Create a password" : "Your password"}
            value={values.password}
            onChange={set("password")}
            error={errors.password}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
          />
        </Field>
      )}

      {mode === "signup" && (
        <Field id={id("confirm")} label="Confirm password" error={errors.confirm}>
          <PasswordInput id={id("confirm")} icon={Lock} name="confirm" autoComplete="new-password" placeholder="Repeat your password" value={values.confirm} onChange={set("confirm")} error={errors.confirm} />
        </Field>
      )}

      {mode === "signin" && (
        <div className="cm-row-between">
          <span />
          <Link className="cm-link" to="/auth?mode=forgot">Forgot password?</Link>
        </div>
      )}

      {mode === "signup" && (
        <div className="cm-field">
          <label className="cm-check" htmlFor={id("terms")}>
            <input
              id={id("terms")}
              type="checkbox"
              checked={values.terms}
              onChange={set("terms")}
              aria-invalid={errors.terms ? "true" : undefined}
              aria-describedby={errors.terms ? `${id("terms")}-error` : undefined}
            />
            <span>
              I agree to the <Link className="cm-link" to="/policies">Masterbook policies</Link>.
            </span>
          </label>
          {errors.terms && <p className="cm-error" id={`${id("terms")}-error`} role="alert">{errors.terms}</p>}
        </div>
      )}

      {notice && (
        <div className={`cm-notice cm-notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <NoticeIcon size={18} aria-hidden="true" />
          <p>{notice.text}</p>
        </div>
      )}

      <button className="cm-btn cm-btn-primary cm-btn-block" type="submit" disabled={busy}>
        {busy ? "Please wait…" : copy.submit}
        {!busy && <ArrowRight size={17} aria-hidden="true" />}
      </button>

      {mode === "forgot" && (
        <Link className="cm-back" to="/auth"><ArrowLeft size={16} aria-hidden="true" /> Back to sign in</Link>
      )}
    </form>
  );
}

/* ---------------- Shopify secure sign-in (Customer Account API) ---------------- */

function SecureSignIn({ mode, returnTo }) {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      await login(returnTo); // leaves the page for Shopify's sign-in
    } catch (err) {
      setError((err && err.message) || "Could not start sign-in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="cm-form">
      <div className="cm-secure">
        <KeyRound size={20} aria-hidden="true" />
        <p>
          {mode === "signup"
            ? "You’ll continue to Shopify’s secure page, where you enter your email to create your account. No password is shared with this site."
            : "You’ll continue to Shopify’s secure page to verify your email. No password is shared with this site."}
        </p>
      </div>
      {error && (
        <div className="cm-notice cm-notice-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      <button type="button" className="cm-btn cm-btn-primary cm-btn-block" onClick={go} disabled={busy}>
        {busy ? "Opening secure sign-in…" : mode === "signup" ? "Continue to create account" : "Continue to sign in"}
        {!busy && <ArrowRight size={17} aria-hidden="true" />}
      </button>
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function Auth() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { authMode, isAuthed, status } = useAuth();

  const raw = params.get("mode");
  const requested = raw === "signup" ? "signup" : raw === "forgot" ? "forgot" : "signin";
  // Shopify's secure sign-in has no separate "forgot password" step.
  const mode = authMode === "oauth" && requested === "forgot" ? "signin" : requested;
  const copy = COPY[mode];
  const returnTo = (location.state && location.state.from) || "/account";

  if (isAuthed) return <Navigate to={returnTo} replace />;

  return (
    <div className="public-shell mx-auto px-4 sm:px-6">
      <div className="cm-auth">
        <aside className="cm-auth-aside" aria-label="Why create an account">
          <div>
            <span className="cm-aside-mark" aria-hidden="true"><Crown size={22} /></span>
            <h2 className="cm-aside-title">Your Masterbook, one sign-in away.</h2>
            <p className="cm-aside-sub">An account keeps your purchases and private reader access together.</p>
          </div>
          <ul className="cm-aside-list">
            <li>
              <BookOpen size={20} aria-hidden="true" />
              <div><strong>Private reader</strong><span>Opens once your payment is verified.</span></div>
            </li>
            <li>
              <Receipt size={20} aria-hidden="true" />
              <div><strong>Orders and invoices</strong><span>Order number, purchase date and status.</span></div>
            </li>
            <li>
              <ShieldCheck size={20} aria-hidden="true" />
              <div><strong>Verified access only</strong><span>Content unlocks for paid orders, nothing else.</span></div>
            </li>
          </ul>
        </aside>

        <section className="cm-auth-card">
          {mode !== "forgot" && (
            <nav className="cm-tabs" aria-label="Account">
              <Link to="/auth" state={location.state} className={mode === "signin" ? "is-active" : ""} aria-current={mode === "signin" ? "page" : undefined}>Sign in</Link>
              <Link to="/auth?mode=signup" state={location.state} className={mode === "signup" ? "is-active" : ""} aria-current={mode === "signup" ? "page" : undefined}>Create account</Link>
            </nav>
          )}
          <h1 id="auth-title" className="cm-auth-title">{copy.title}</h1>
          <p className="cm-auth-sub">{copy.sub}</p>

          {status === "loading" ? (
            <p className="cm-muted" aria-live="polite">Checking your session…</p>
          ) : authMode === "oauth" ? (
            <SecureSignIn key={mode} mode={mode} returnTo={returnTo} />
          ) : (
            <PasswordForm key={mode} mode={mode} returnTo={returnTo} />
          )}

          {mode === "signin" && (
            <p className="cm-switch">New here? <Link className="cm-link" to="/auth?mode=signup" state={location.state}>Create an account</Link></p>
          )}
          {mode === "signup" && (
            <p className="cm-switch">Already have an account? <Link className="cm-link" to="/auth" state={location.state}>Sign in</Link></p>
          )}
        </section>
      </div>
    </div>
  );
}
