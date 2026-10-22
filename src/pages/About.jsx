import { Link } from "react-router-dom";
import {
  BookOpen, Sparkles, Target, WandSparkles, Compass, ShieldCheck, Layers,
  ArrowRight, Mail, Phone, MapPin, FileText, Lightbulb, Check,
} from "lucide-react";
import Img from "../components/Img.jsx";
import { COMPANY } from "../data/company.js";

const STATS = [
  { value: "9", label: "Chapters" },
  { value: "5", label: "Case studies" },
  { value: "12", label: "Studio prompts" },
  { value: "1×", label: "One-time purchase" },
];

const OFFERINGS = [
  {
    icon: BookOpen,
    tag: "Available now",
    title: "The Masterbook",
    text: "The Top Secret Content Collection Book Of The Viral Influencers: nine chapters, five case studies and twelve studio prompts, read in a private online reader after verified payment.",
  },
  {
    icon: WandSparkles,
    tag: "Separate subscription",
    title: "The AI Library",
    text: "A prompt library for creators, offered as its own subscription and kept apart from the one-time Masterbook purchase.",
    to: "/ai",
    cta: "Explore AI Library",
  },
  {
    icon: Layers,
    tag: "Planned",
    title: "More titles",
    text: "Creator Moves 365 is being built so additional e-books can be added and sold alongside the Masterbook as the catalogue grows.",
  },
];

const PRINCIPLES = [
  {
    icon: Compass,
    title: "Practical before polished",
    text: "Every chapter, case study and prompt is written to be used: ideas, hooks, visual direction and a workflow you can repeat.",
  },
  {
    icon: Sparkles,
    title: "Yours, not a copy",
    text: "The aim is a recognisable presence of your own. The book shows how standout creators work; it never asks you to copy someone else’s personality.",
  },
  {
    icon: ShieldCheck,
    title: "Clear, verified access",
    text: "One-time purchase, a private reader, and access that opens only for a verified paid order. No hidden steps, no ambiguity about what you get.",
  },
  {
    icon: Target,
    title: "Tool-agnostic",
    text: "Prompts and directions work in the AI or content tool you already prefer. No particular tool is required.",
  },
];

const JOURNEY = [
  { title: "Place your order", text: "Choose the Masterbook and keep your private order link." },
  { title: "Payment is verified", text: "Access opens only after a verified payment, never before." },
  { title: "Read in the private reader", text: "Open any chapter, case study or studio prompt online." },
  { title: "Apply and publish", text: "Adapt the direction to your own work, then share it. Use the reader’s Print button to save a PDF." },
];

export default function About() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6">
      <div className="cm-page">
        {/* Hero */}
        <section className="cm-about-hero" aria-labelledby="about-title">
          <div className="cm-about-hero-copy">
            <span className="cm-eyebrow"><Sparkles size={14} aria-hidden="true" /> About Us</span>
            <h1 id="about-title" className="cm-h1">
              A focused digital publication for your <span className="cm-gradient-text">next creative move.</span>
            </h1>
            <p className="cm-lead">
              Creator Moves 365 turns what makes standout creators consistent into a clear, structured book:
              content ideas, creative prompts and a repeatable publishing workflow, all in one place.
            </p>
            <div className="cm-actions">
              <Link className="cm-btn cm-btn-primary" to="/products">Get the Masterbook <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="cm-btn cm-btn-outline" to="/contact">Contact us</Link>
            </div>
          </div>
          <div className="cm-about-hero-visual" aria-hidden="true">
            <Img src="/assets/home-neon-BWadRMhr.webp" alt="" loading="eager" />
          </div>
        </section>

        {/* Stats */}
        <section aria-label="The Masterbook at a glance">
          <dl className="cm-stats">
            {STATS.map((s) => (
              <div key={s.label} className="cm-stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Who we are */}
        <section className="cm-split" aria-labelledby="who-title">
          <div>
            <h2 id="who-title" className="cm-h2">Who we <span className="cm-gradient-text">are</span></h2>
          </div>
          <div className="cm-prose">
            <p>
              Creator Moves 365 is published by <strong>{COMPANY.legalName}</strong> ({COMPANY.shortName}), based
              in Patna, Bihar, India.
            </p>
            <p>
              We built it for people who want to publish better content with less guesswork: beginners looking for a
              starting point, aspiring creators shaping a voice, working creators who need a repeatable structure, and
              small brands that want content that feels like their own.
            </p>
            <p>
              The Masterbook gathers its ideas, case studies and prompts into one publication, so you always know
              where to look next.
            </p>
          </div>
        </section>

        {/* What we publish */}
        <section aria-labelledby="publish-title">
          <div className="cm-section-head">
            <h2 id="publish-title" className="cm-h2">What we <span className="cm-gradient-text">publish</span></h2>
            <p className="cm-lead">One flagship book today, with room to grow.</p>
          </div>
          <div className="cm-cards cm-cards-3">
            {OFFERINGS.map((o) => (
              <article key={o.title} className="cm-card">
                <span className="cm-card-icon"><o.icon size={22} aria-hidden="true" /></span>
                <span className="cm-tag">{o.tag}</span>
                <h3>{o.title}</h3>
                <p>{o.text}</p>
                {o.to && <Link className="cm-link cm-card-link" to={o.to}>{o.cta} <ArrowRight size={15} aria-hidden="true" /></Link>}
              </article>
            ))}
          </div>
        </section>

        {/* Principles */}
        <section aria-labelledby="principles-title">
          <div className="cm-section-head">
            <h2 id="principles-title" className="cm-h2">How we <span className="cm-gradient-text">work</span></h2>
            <p className="cm-lead">The principles behind every page.</p>
          </div>
          <div className="cm-cards cm-cards-2">
            {PRINCIPLES.map((p) => (
              <article key={p.title} className="cm-card cm-card-row">
                <span className="cm-card-icon"><p.icon size={22} aria-hidden="true" /></span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Journey */}
        <section aria-labelledby="journey-title">
          <div className="cm-section-head">
            <h2 id="journey-title" className="cm-h2">From order to <span className="cm-gradient-text">published</span></h2>
            <p className="cm-lead">What to expect after you buy.</p>
          </div>
          <ol className="cm-journey">
            {JOURNEY.map((j, i) => (
              <li key={j.title}>
                <span className="cm-journey-num">{i + 1}</span>
                <h3>{j.title}</h3>
                <p>{j.text}</p>
              </li>
            ))}
          </ol>
          <p className="cm-fineprint"><Lightbulb size={15} aria-hidden="true" /> Online payment is not switched on yet; access always requires a verified paid order.</p>
        </section>

        {/* Company details */}
        <section className="cm-company" aria-labelledby="company-title">
          <div>
            <h2 id="company-title" className="cm-h2">Company details</h2>
            <p className="cm-lead">The business behind Creator Moves 365.</p>
          </div>
          <dl className="cm-details">
            <div><dt><FileText size={16} aria-hidden="true" /> Registered name</dt><dd>{COMPANY.legalName} ({COMPANY.shortName})</dd></div>
            <div><dt><Check size={16} aria-hidden="true" /> GSTIN</dt><dd>{COMPANY.gstin}</dd></div>
            <div><dt><MapPin size={16} aria-hidden="true" /> Address</dt><dd>{COMPANY.addressLines.map((l) => <span key={l} className="cm-block">{l}</span>)}</dd></div>
            <div><dt><Mail size={16} aria-hidden="true" /> Email</dt><dd><a className="cm-link" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></dd></div>
            <div><dt><Phone size={16} aria-hidden="true" /> Phone</dt><dd><a className="cm-link" href={COMPANY.phoneHref}>{COMPANY.phoneDisplay}</a></dd></div>
          </dl>
        </section>

        {/* CTA */}
        <section className="cm-cta" aria-labelledby="about-cta-title">
          <h2 id="about-cta-title">Ready to make your next move?</h2>
          <p>Get the Masterbook, or write to us if you have a question first.</p>
          <div className="cm-actions cm-actions-center">
            <Link className="cm-btn cm-btn-light" to="/products">Get the Masterbook <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className="cm-btn cm-btn-ghost-light" to="/contact">Contact us</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
