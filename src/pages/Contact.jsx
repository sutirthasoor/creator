import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail, Phone, MapPin, Send, User, Info, ArrowRight, Sparkles, ExternalLink,
} from "lucide-react";
import { Field, TextInput, describedBy } from "../components/Field.jsx";
import { COMPANY, MAPS_URL, CONTACT_TOPICS } from "../data/company.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_MESSAGE = 1500;

const CHANNELS = [
  {
    icon: Mail,
    title: "Email customer care",
    value: COMPANY.email,
    href: `mailto:${COMPANY.email}`,
    note: "Best for order, access and payment questions.",
  },
  {
    icon: Phone,
    title: "Call us",
    value: COMPANY.phoneDisplay,
    href: COMPANY.phoneHref,
    note: "Have your order number ready.",
  },
  {
    icon: MapPin,
    title: "Visit or write to us",
    value: COMPANY.addressLines.join(", "),
    href: MAPS_URL,
    external: true,
    note: "Registered office of AA100XTech.",
  },
];

const HELP = [
  "Order status and private order links",
  "Access to the reader after payment",
  "Payment and invoice questions",
  "Questions about the Masterbook’s content",
  "The affiliate and influencer program",
  "Business enquiries and partnerships",
];

function ContactForm() {
  const [values, setValues] = useState({ name: "", email: "", topic: CONTACT_TOPICS[0], order: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (key) => (ev) => {
    setValues((v) => ({ ...v, [key]: ev.target.value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    setSent(false);
  };

  function onSubmit(ev) {
    ev.preventDefault();
    const e = {};
    if (values.name.trim().length < 2) e.name = "Enter your name.";
    if (!EMAIL_RE.test(values.email.trim())) e.email = "Enter a valid email address so we can reply.";
    if (values.message.trim().length < 10) e.message = "Tell us a little more (at least 10 characters).";
    setErrors(e);
    const first = ["name", "email", "message"].find((k) => e[k]);
    if (first) {
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    const subject = `[Creator Moves 365] ${values.topic}`;
    const body = [
      `Name: ${values.name.trim()}`,
      `Email: ${values.email.trim()}`,
      values.order.trim() ? `Order number: ${values.order.trim()}` : null,
      `Topic: ${values.topic}`,
      "",
      values.message.trim(),
    ].filter((l) => l !== null).join("\n");
    // No mail server is connected yet, so the message is handed to the visitor's own email app.
    window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const msgLeft = MAX_MESSAGE - values.message.length;

  return (
    <form className="cm-form" onSubmit={onSubmit} noValidate aria-labelledby="contact-form-title">
      <div className="cm-form-grid">
        <Field id="contact-name" label="Your name" error={errors.name}>
          <TextInput id="contact-name" icon={User} name="name" autoComplete="name" placeholder="Your name" value={values.name} onChange={set("name")} error={errors.name} />
        </Field>
        <Field id="contact-email" label="Email address" error={errors.email}>
          <TextInput id="contact-email" icon={Mail} type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={values.email} onChange={set("email")} error={errors.email} />
        </Field>
      </div>

      <div className="cm-form-grid">
        <Field id="contact-topic" label="What is this about?">
          <select id="contact-topic" name="topic" className="cm-input cm-select" value={values.topic} onChange={set("topic")}>
            {CONTACT_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field id="contact-order" label="Order number" optional>
          <TextInput id="contact-order" name="order" autoComplete="off" placeholder="If you have one" value={values.order} onChange={set("order")} />
        </Field>
      </div>

      <Field id="contact-message" label="Message" error={errors.message} hint={`${msgLeft} characters left`}>
        <textarea
          id="contact-message"
          name="message"
          className="cm-input cm-textarea"
          rows={6}
          maxLength={MAX_MESSAGE}
          placeholder="How can we help?"
          value={values.message}
          onChange={set("message")}
          aria-invalid={errors.message ? "true" : undefined}
          aria-describedby={describedBy("contact-message", { error: errors.message, hint: `${msgLeft}` })}
        />
      </Field>

      {sent && (
        <div className="cm-notice cm-notice-info" role="status">
          <Info size={18} aria-hidden="true" />
          <p>
            Your email app should open with this message ready to send. If nothing opened, write to{" "}
            <a className="cm-link" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> directly.
          </p>
        </div>
      )}

      <button className="cm-btn cm-btn-primary cm-btn-block" type="submit">
        Send message <Send size={16} aria-hidden="true" />
      </button>
      <p className="cm-fineprint">This opens your email app to send the message to our customer care address.</p>
    </form>
  );
}

export default function Contact() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        <section className="cm-contact-hero" aria-labelledby="contact-title">
          <span className="cm-eyebrow"><Sparkles size={14} aria-hidden="true" /> Contact Us</span>
          <h1 id="contact-title" className="cm-h1">We’re here to <span className="cm-gradient-text">help.</span></h1>
          <p className="cm-lead">
            Questions about an order, your access to the Masterbook, payments or the affiliate program? Reach us
            below, or send a message and we’ll reply by email.
          </p>
        </section>

        <section className="cm-contact-grid" aria-label="Contact options">
          <div className="cm-contact-side">
            <ul className="cm-channels">
              {CHANNELS.map((c) => (
                <li key={c.title}>
                  <a
                    className="cm-channel"
                    href={c.href}
                    {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="cm-card-icon"><c.icon size={20} aria-hidden="true" /></span>
                    <span className="cm-channel-body">
                      <span className="cm-channel-title">{c.title} {c.external && <ExternalLink size={13} aria-hidden="true" />}</span>
                      <span className="cm-channel-value">{c.value}</span>
                      <span className="cm-channel-note">{c.note}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="cm-help">
              <h2>We can help with</h2>
              <ul>
                {HELP.map((h) => <li key={h}>{h}</li>)}
              </ul>
              <p>
                Quick answers may already be in the <Link className="cm-link" to="/#faq">FAQ</Link>.
              </p>
            </div>
          </div>

          <div className="cm-contact-card">
            <h2 id="contact-form-title" className="cm-form-title">Send us a message</h2>
            <p className="cm-form-sub">Include your order number if you have one so we can find it faster.</p>
            <ContactForm />
          </div>
        </section>

        <section className="cm-company" aria-labelledby="contact-company-title">
          <div>
            <h2 id="contact-company-title" className="cm-h2">Business details</h2>
            <p className="cm-lead">For invoices, partnerships and official correspondence.</p>
          </div>
          <dl className="cm-details">
            <div><dt>Registered name</dt><dd>{COMPANY.legalName} ({COMPANY.shortName})</dd></div>
            <div><dt>GSTIN</dt><dd>{COMPANY.gstin}</dd></div>
            <div><dt>Address</dt><dd>{COMPANY.addressLines.map((l) => <span key={l} className="cm-block">{l}</span>)}</dd></div>
          </dl>
        </section>

        <section className="cm-cta" aria-labelledby="contact-cta-title">
          <h2 id="contact-cta-title">Learn more about Creator Moves 365</h2>
          <p>See who is behind the Masterbook and how it works.</p>
          <div className="cm-actions cm-actions-center">
            <Link className="cm-btn cm-btn-light" to="/about">About Us <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className="cm-btn cm-btn-ghost-light" to="/products">Get the Masterbook</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
