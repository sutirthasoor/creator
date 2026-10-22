import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { usePartner } from "../../context/PartnerContext.jsx";
import { Field, TextInput, PasswordInput } from "../../components/Field.jsx";
import { Notice } from "./ui.jsx";

export default function PartnerAuth() {
  const { status, signIn, signUp, reset } = usePartner();
  const [params, setParams] = useSearchParams();
  const mode = ["signup", "forgot"].includes(params.get("mode")) ? params.get("mode") : "signin";
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={(state && state.from) || "/partner"} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => { setError(""); setInfo(""); setParams(m === "signin" ? {} : { mode: m }); };

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo("");
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (mode !== "forgot" && form.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "forgot") { await reset(email); setInfo("If an account exists for that email, a reset link is on its way."); }
      else if (mode === "signup") { await signUp(email, form.password); navigate("/partner", { replace: true }); }
      else { await signIn(email, form.password); navigate((state && state.from) || "/partner", { replace: true }); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your partner account" : mode === "forgot" ? "Reset your password" : "Partner sign in";
  return (
    <div className="public-shell mx-auto px-4 sm:px-6">
      <div className="pt-auth-wrap">
        <form className="cm-card cm-form pt-auth-card" onSubmit={submit} noValidate>
          <span className="cm-eyebrow">Creator Moves 365 partners</span>
          <h1 className="cm-h2">{title}</h1>
          <p className="cm-muted">For influencers. Shoppers sign in from the main site, and the Creator Moves team uses a separate admin sign-in.</p>
          <Notice>{error}</Notice>
          <Notice kind="success">{info}</Notice>
          <Field id="p-email" label="Email">
            <TextInput id="p-email" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
          </Field>
          {mode !== "forgot" && (
            <Field id="p-pass" label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <PasswordInput id="p-pass" icon={Lock} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={form.password} onChange={set("password")} required />
            </Field>
          )}
          <button className="cm-btn cm-btn-primary cm-btn-block" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
          <p className="cm-fineprint">
            {mode === "signin" && (<><button type="button" className="cm-link cm-linkbtn" onClick={() => go("forgot")}>Forgot password?</button> · <button type="button" className="cm-link cm-linkbtn" onClick={() => go("signup")}>Create an account</button></>)}
            {mode !== "signin" && <button type="button" className="cm-link cm-linkbtn" onClick={() => go("signin")}>Back to sign in</button>}
          </p>
        </form>
      </div>
    </div>
  );
}
