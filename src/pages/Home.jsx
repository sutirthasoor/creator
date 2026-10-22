import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Compass, Target, Sparkles, WandSparkles, BookOpen, Lightbulb,
  LockKeyhole, ArrowLeft, ArrowRight, Check, Play, ChevronDown,
} from "lucide-react";
import Hero from "../components/Hero.jsx";
import Img from "../components/Img.jsx";
import {
  VISUAL_STRIP, FEATURES, PREVIEW_PAGES, STEPS, WATCH_POINTS,
  AUDIENCE, FAQ, PRICING, PRODUCT_TITLE,
} from "../data/content.js";
import { BTN_ICON_OUTLINE, BTN_ICON_GHOST, BTN_FINAL_CTA } from "../cls.js";

const ICONS = { Compass, Target, Sparkles, WandSparkles, BookOpen, Lightbulb };

function Inside() {
  return (
    <section id="whats-inside" className="master-section master-inside" aria-labelledby="inside-title">
      <div className="master-inside-head home-reveal">
        <h2 id="inside-title">What's Inside <span className="master-gradient-text">The Masterbook?</span></h2>
        <p>9 chapters, 5 case studies, 12 studio prompts</p>
      </div>
      <div className="master-feature-grid">
        {FEATURES.map((f, i) => {
          const Icon = ICONS[f.icon];
          return (
            <article key={f.title} className="master-feature home-reveal">
              <span className={`master-feature-icon master-feature-icon-${i}`}><Icon size={23} aria-hidden="true" /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          );
        })}
      </div>
      <p className="master-inside-note"><LockKeyhole size={15} aria-hidden="true" /> Full book access follows a verified paid order.</p>
    </section>
  );
}

function Preview() {
  const [step, setStep] = useState(0);
  const last = PREVIEW_PAGES.length - 1;
  return (
    <section className="master-preview master-section" aria-labelledby="preview-title">
      <div className="master-preview-head">
        <div className="home-reveal">
          <h2 id="preview-title">See What <span className="master-gradient-text">You'll Get</span></h2>
          <p>Designed topic previews, not protected book pages. Reading opens after verified payment.</p>
        </div>
        <span className="master-preview-pill">Preview Sample Pages</span>
      </div>
      <div className="master-preview-window">
        <div className="master-preview-track" style={{ transform: `translateX(calc(-${step} * var(--preview-step)))` }}>
          {PREVIEW_PAGES.map((title, i) => (
            <div key={title} className={`master-preview-page master-preview-page-${i}`}>
              <span>CREATOR MOVES 365 / 0{i + 1}</span>
              <span className="master-preview-art" aria-hidden="true"><i></i><i></i><i></i></span>
              <div>
                <small>THE MASTERBOOK</small>
                <strong>{title}</strong>
                <span className="master-preview-rule"></span>
                <p>Creative notes &amp; direction</p>
              </div>
              <span>DESIGNED TOPIC PREVIEW</span>
            </div>
          ))}
        </div>
      </div>
      <div className="master-preview-controls">
        <button className={BTN_ICON_OUTLINE} aria-label="Previous sample topic" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="master-preview-dots" aria-label="Sample topic position">
          {PREVIEW_PAGES.map((title, i) => (
            <button key={title} className={`${BTN_ICON_GHOST}${i === step ? " is-active" : ""}`} aria-label={`Show ${title}`} aria-current={i === step} onClick={() => setStep(i)}>
              <span></span>
            </button>
          ))}
        </div>
        <button className={BTN_ICON_OUTLINE} aria-label="Next sample topic" disabled={step === last} onClick={() => setStep((s) => Math.min(last, s + 1))}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function HowTo() {
  return (
    <section id="how-to-use" className="master-section master-how" aria-labelledby="how-title">
      <div className="master-heading home-reveal">
        <h2 id="how-title">How to <span className="master-gradient-text">Use</span> This Masterbook?</h2>
        <p>From the page to something distinctly yours.</p>
      </div>
      <ol className="master-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="master-step home-reveal">
            <div className="master-step-image"><Img src={s.img} alt="" loading="lazy" width={500} height={360} /></div>
            <span className="master-step-number">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="master-watch home-reveal">
        <div className="master-watch-image">
          <Img src="/assets/home-workflow-CYQZ6RR0.webp" alt="Creative planning workspace with visual reference sheets" loading="lazy" width={1024} height={768} />
          <span className="master-watch-icon" aria-hidden="true"><Play size={30} fill="currentColor" /></span>
          <span className="master-watch-label">WORKFLOW IMAGE PREVIEW · NOT A VIDEO</span>
        </div>
        <div className="master-watch-copy">
          <h3>Watch <span className="master-gradient-text">How It Works</span></h3>
          <p>Move from an idea to a visual reference, then shape the result for your own work.</p>
          <ul>
            {WATCH_POINTS.map((p) => (
              <li key={p}><Check size={17} aria-hidden="true" /> {p}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section id="who-its-for" className="master-section master-audience" aria-labelledby="audience-title">
      <div className="master-heading home-reveal">
        <h2 id="audience-title">Who Is This <span className="master-gradient-text">Masterbook For?</span></h2>
      </div>
      <div className="master-audience-grid">
        {AUDIENCE.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <article key={a.title} className="master-audience-card home-reveal">
              <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="master-section master-faq" aria-labelledby="faq-title">
      <div className="master-faq-intro home-reveal">
        <h2 id="faq-title">Frequently Asked <span className="master-gradient-text">Questions</span></h2>
        <p>Clear answers before you make your move.</p>
      </div>
      <div className="master-faq-list">
        {FAQ.map((item, i) => (
          <details key={item.q} className="master-faq-item home-reveal">
            <summary>
              <span className="master-faq-number">0{i + 1}</span>
              <span>{item.q}</span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Final() {
  return (
    <section className="master-final home-reveal" aria-labelledby="final-title">
      <div className="master-final-copy">
        <h2 id="final-title">Start Your Influencer Journey Today</h2>
        <p>{PRODUCT_TITLE} · One-time purchase <span className="master-final-price">{PRICING.current}</span></p>
        <Link className={BTN_FINAL_CTA} to="/products">
          Get Your Masterbook Now <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p className="master-final-values">
          <span>One-Time Purchase</span><span>Private Reader</span><span>Verified Access</span>
        </p>
        <p className="master-final-note">Online payment is not switched on yet. Access requires a verified paid order.</p>
      </div>
      <span className="master-final-deco master-final-deco-one" aria-hidden="true"><Sparkles size={42} /></span>
      <span className="master-final-deco master-final-deco-two" aria-hidden="true"><Play size={34} /></span>
    </section>
  );
}

export default function Home() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6 ">
      <Hero />
      <div className="home-storefront">
        <div className="master-visual-strip" aria-label="Creator studio inspiration">
          {VISUAL_STRIP.map((v) => (
            <div key={v.src} className="master-visual-tile home-reveal">
              <Img src={v.src} alt={v.alt} width={600} height={380} loading="lazy" />
            </div>
          ))}
        </div>
        <Inside />
        <Preview />
        <HowTo />
        <Audience />
        <Faq />
        <Final />
      </div>
    </div>
  );
}
