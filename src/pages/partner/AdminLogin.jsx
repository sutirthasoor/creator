import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { Field, TextInput, PasswordInput } from "../../components/Field.jsx";
import { Notice } from "./ui.jsx";

// Admin sign-in. Separate from the partner sign-in: it has no sign-up, and partner accounts are refused.
export default function AdminLogin() {
  const { status, signIn, reset } = useAdmin();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "authed") return <Navigate to={(state && state.from) || "/admin"} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo("");
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (mode === "signin" && form.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "forgot") { await reset(email); setInfo("If an admin account exists for that email, a reset link is on its way."); }
      else { await signIn(email, form.password); navigate((state && state.from) || "/admin", { replace: true }); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-auth-wrap">
      <form className="cm-card cm-form pt-auth-card" onSubmit={submit} noValidate>
        <span className="cm-eyebrow">Creator Moves 365 admin</span>
        <h1 className="cm-h2">{mode === "forgot" ? "Reset your password" : "Admin sign in"}</h1>
        <p className="cm-muted">For the Creator Moves team only. Influencers sign in on the partner page.</p>
        <Notice>{error}</Notice>
        <Notice kind="success">{info}</Notice>
        <Field id="a-email" label="Email">
          <TextInput id="a-email" icon={Mail} type="email" autoComplete="username" value={form.email} onChange={set("email")} required />
        </Field>
        {mode === "signin" && (
          <Field id="a-pass" label="Password">
            <PasswordInput id="a-pass" icon={Lock} autoComplete="current-password" value={form.password} onChange={set("password")} required />
          </Field>
        )}
        <button className="cm-btn cm-btn-primary cm-btn-block" disabled={busy}>
          {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : "Sign in"}
        </button>
        <p className="cm-fineprint">
          <button type="button" className="cm-link cm-linkbtn" onClick={() => { setError(""); setInfo(""); setMode(mode === "forgot" ? "signin" : "forgot"); }}>
            {mode === "forgot" ? "Back to sign in" : "Forgot password?"}
          </button>
        </p>
      </form>
    </div>
  );
}
