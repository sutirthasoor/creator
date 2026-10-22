import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, BookOpen, LockKeyhole, Target, WandSparkles, Sparkles, Lightbulb, FileText, ArrowRight, Crown } from "lucide-react";
import Img from "./Img.jsx";
import { HERO_SLIDES, PRICING, PRODUCT_TITLE } from "../data/content.js";
import { BTN_HERO_CTA } from "../cls.js";

export default function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = HERO_SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [paused, count]);

  return (
    <section className="home-hero relative isolate border-b border-border">
      <div className="home-hero-layout">
        <div className="home-hero-copy relative z-10 min-w-0 text-left">
          <span className="home-hero-badge">
            <span className="home-hero-status-dot" aria-hidden="true" /> Creator edition · digital PDF eBook
          </span>
          <h1 className="home-hero-title font-display font-bold">
            The Top Secret Content Collection Book Of{" "}
            <span className="home-hero-highlight">The Viral Influencers</span> that built them a loyal audience.
          </h1>
          <p className="home-hero-intro max-w-lg text-muted-foreground">
            Learn how standout creators turn ideas into stronger content, publish with more consistency, and build a recognisable presence—without copying someone else’s personality.
          </p>

          <div className="home-hero-benefit-matrix" aria-label="Masterbook benefits">
            <span><Target size={15} aria-hidden="true" /> Content Strategies</span>
            <span><WandSparkles size={15} aria-hidden="true" /> Creative Prompts</span>
            <span><BookOpen size={15} aria-hidden="true" /> Step-by-Step Guide</span>
            <span><Sparkles size={15} aria-hidden="true" /> Real Examples</span>
          </div>

          <div className="home-hero-offer max-w-md">
            <div className="home-hero-product font-display font-semibold text-foreground/90">{PRODUCT_TITLE}</div>
            <Link aria-label="Get the eBook at the launch discount price" className="home-hero-price-link flex items-stretch overflow-hidden" to="/products">
              <div className="home-hero-price-original flex flex-col justify-center gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Original</span>
                <span className="font-display text-base font-bold text-muted-foreground line-through sm:text-lg">{PRICING.original}</span>
              </div>
              <div className="home-hero-price-current flex flex-[1.3] items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold uppercase text-primary-foreground/90">Launch discount active</span>
                  <span className="font-display text-2xl font-bold text-primary-foreground sm:text-[28px]">{PRICING.current}</span>
                </div>
                <span className="home-hero-discount shrink-0 text-[10px] font-semibold">{PRICING.discount}% off</span>
              </div>
              <span className="home-hero-offer-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
              </span>
            </Link>
          </div>

          <Link className={BTN_HERO_CTA} to="/products">
            Get Your Masterbook Now <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <p className="master-hero-assurance">
            <Check size={15} aria-hidden="true" /> One-time purchase <span aria-hidden="true">·</span>{" "}
            <BookOpen size={15} aria-hidden="true" /> Private reader <span aria-hidden="true">·</span>{" "}
            <LockKeyhole size={15} aria-hidden="true" /> Verified access
          </p>

          <div className="home-hero-benefits flex flex-wrap items-center text-muted-foreground">
            <span>Content direction</span><span aria-hidden="true">•</span>
            <span>Creative prompts</span><span aria-hidden="true">•</span>
            <span>Publishing consistency</span>
          </div>

          <div className="home-hero-inside">
            <span className="home-hero-inside-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5c2.6-1 5.3-.8 8 1v12c-2.7-1.8-5.4-2-8-1V5.5Zm16 0c-2.6-1-5.3-.8-8 1v12c2.7-1.8 5.4-2 8-1V5.5Z" />
              </svg>
            </span>
            <div className="home-hero-inside-label text-[10px] font-semibold uppercase text-accent">Inside the eBook</div>
            <p className="mt-1.5 text-sm font-semibold leading-snug">Ideas, hooks, visual direction and repeatable creator workflows.</p>
          </div>
        </div>

        <div className="home-hero-visual relative min-w-0">
          <span className="master-hero-float master-hero-float-one" aria-hidden="true"><Lightbulb size={17} /> Practical Examples</span>
          <span className="master-hero-float master-hero-float-three" aria-hidden="true"><Target size={17} /> Growth Strategies</span>
          <span className="master-hero-float master-hero-float-two" aria-hidden="true"><FileText size={17} /> Content Workflow</span>
          <span className="master-hero-float master-hero-float-four" aria-hidden="true"><WandSparkles size={17} /> Creative Ideas</span>

          <div className="master-book-scene" aria-label={`${PRODUCT_TITLE} book mockup`}>
            <div className="master-book-cover">
              <Img
                src="/assets/masterbook-cover-art-DzA6LFXW.jpg"
                alt="Silhouette of a creator in a neon-lit studio on the Masterbook cover"
                width={1024}
                height={1536}
                fetchpriority="high"
              />
              <div className="master-cover-type">
                <span><Crown size={22} aria-hidden="true" /> CREATOR MOVES 365</span>
                <strong>THE VIRAL<br />INFLUENCERS<br /><em>MASTERBOOK</em></strong>
                <small>First edition · DIGITAL EDITION</small>
              </div>
            </div>
          </div>

          <div className="master-hero-facts">
            <BookOpen size={18} aria-hidden="true" /> 9 chapters, 5 case studies, 12 studio prompts
          </div>

          <div className="home-hero-stage relative mx-auto aspect-square w-full max-w-[720px]">
            <div
              className="relative h-full w-full"
              role="region"
              aria-roledescription="carousel"
              aria-label="Creator images"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl outline-1 -outline-offset-1 outline-border">
                {HERO_SLIDES.map((s, i) => (
                  <Img
                    key={s.src}
                    src={s.src}
                    alt={s.alt}
                    width={1408}
                    height={1408}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchpriority={i === 0 ? "high" : "auto"}
                    aria-hidden={i !== index}
                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
                  />
                ))}
              </div>
              <button type="button" aria-label="Previous image" className="glass absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none transition hover:scale-105 sm:left-3" onClick={() => setIndex((i) => (i - 1 + count) % count)}>‹</button>
              <button type="button" aria-label="Next image" className="glass absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none transition hover:scale-105 sm:right-3" onClick={() => setIndex((i) => (i + 1) % count)}>›</button>
              <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-2">
                {HERO_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to image ${i + 1}`}
                    aria-current={i === index}
                    className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-accent" : "w-2 bg-foreground/30 hover:bg-foreground/50"}`}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
