import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AnimatedSection from "@/components/AnimatedSection";
import Counter from "@/components/Counter";
import { upcomingEvents } from "@/data/events";

import { GradientDots } from "@/components/ui/gradient-dots";
import {
  ChevronDown,
  Calendar,
  MapPin,
  Lightbulb,
  Users,
  Rocket,
  GraduationCap,
  Cpu,
  Sparkles,
  Network,
} from "lucide-react";

const DEFAULT_TARGET_DATE = new Date("2026-04-25T09:00:00").getTime();

function useCountdown(targetTime: number) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, targetTime - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  return timeLeft;
}

const featureCards = [
  {
    icon: Lightbulb,
    title: "Innovation & Startup Culture",
    desc: "A high-energy environment where ambitious ideas are prototyped, validated, and launched.",
  },
  {
    icon: Rocket,
    title: "Hackathons & Competitions",
    desc: "From ideation sprints to Clash of Coders, push your limits in curated challenges.",
  },
  {
    icon: Users,
    title: "Industry Mentorship",
    desc: "Access mentors, founders, and alumni who have built products and companies in the real world.",
  },
  {
    icon: GraduationCap,
    title: "Skill Development Workshops",
    desc: "Deep-dive sessions on product, tech, design, pitch-building, and everything startup.",
  },
];

const stats = [
  { label: "Students Impacted", value: 500, suffix: "+", sub: "From EII & across RKGIT" },
  { label: "Events Organized", value: 25, suffix: "+", sub: "Hackathons, talks & summits" },
  { label: "Startup Ideas Incubated", value: 7, suffix: "+", sub: "Early-stage concepts nurtured" },
  { label: "Industry Collaborations", value: 5, suffix: "+", sub: "MoUs, mentors & partners" },
];

import { getFirebaseEvents } from "@/services/firebaseEvents";

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const cleanStr = dateStr.includes("-") ? dateStr.replace(/-/g, "/") : dateStr;
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime()) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr.trim())) {
    return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return dateStr;
};

const Index = () => {
  const [featuredEvent, setFeaturedEvent] = useState(upcomingEvents[0]);

  useEffect(() => {
    let isMounted = true;
    getFirebaseEvents()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          // Prioritize latest open event for registration
          const openEvents = data.filter((e) => e.status === "open");
          const next =
            openEvents[0] ||
            data.find((e) => e.featured && e.status !== "ended") ||
            data.find((e) => e.status === "upcoming") ||
            data[0];
          if (next) setFeaturedEvent(next);
        }
      })
      .catch((err) => console.warn("[Index] Fallback to local featured event:", err));

    return () => {
      isMounted = false;
    };
  }, []);

  const targetTime = featuredEvent?.date && !isNaN(new Date(featuredEvent.date.includes("-") ? featuredEvent.date.replace(/-/g, "/") : featuredEvent.date).getTime())
    ? new Date(featuredEvent.date.includes("-") ? featuredEvent.date.replace(/-/g, "/") : featuredEvent.date).getTime()
    : DEFAULT_TARGET_DATE;

  const countdown = useCountdown(targetTime);


  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 text-center overflow-hidden">
        <GradientDots duration={25} spacing={14} dotSize={7} className="-z-20 opacity-80" />

        <AnimatedSection className="max-w-4xl relative">
          <div className="mb-12">
            <div className="inline-block rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-8 py-4 shadow-lg shadow-primary/20 backdrop-blur-sm mb-8 mt-4 sm:mt-10">
              <span className="inline-flex items-center gap-3">
                <span className="text-lg sm:text-xl font-bold text-primary uppercase tracking-wider">
                  Entrepreneurship Cell RKGIT
                </span>
              </span>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-5">
            <span className="block mb-1 text-gradient">Empowering Innovation.</span>
            <span className="block">Building Future Entrepreneurs.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A student-led innovation and entrepreneurship society where ideas transform into impactful ventures —
            from first prototypes to stage-ready pitches.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {featuredEvent && featuredEvent.status === "open" ? (
              <Button asChild size="lg" className="font-bold shadow-lg shadow-primary/25">
                <Link to={`/register/${featuredEvent.id}`}>
                  Register Now for {featuredEvent.name}
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/events">Explore Events</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/join">Join the Community</Link>
            </Button>
          </div>

          {/* Floating icon row */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1 glass-card">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span>Startup Tech & AI</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1 glass-card">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span>Innovation Sprints</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1 glass-card">
              <Network className="h-3.5 w-3.5 text-primary" />
              <span>Founder & Mentor Network</span>
            </div>
          </div>
        </AnimatedSection>

        <a
          href="#countdown"
          className="absolute bottom-8 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll down"
        >
          <ChevronDown className="h-5 w-5 animate-bounce" />
        </a>
      </section>

      {/* Countdown / Next event highlight */}
      <section id="countdown" className="section-padding-sm border-y border-border/40 bg-muted/10">
        <div className="container mx-auto px-4 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold mb-3 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LATEST EVENT OPEN FOR REGISTRATION
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold mb-2">{featuredEvent.name}</h2>
            <div className="flex items-center justify-center gap-3 text-muted-foreground text-xs sm:text-sm mb-8 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-primary" /> {formatEventDate(featuredEvent.date)}
              </span>
              {featuredEvent.time && (
                <>
                  <span className="text-border">&bull;</span>
                  <span>{featuredEvent.time}</span>
                </>
              )}
              <span className="text-border">&bull;</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-primary" /> {featuredEvent.venue}
              </span>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="flex justify-center gap-4 sm:gap-8 mb-8">
              {[
                { val: countdown.days, label: "Days" },
                { val: countdown.hours, label: "Hours" },
                { val: countdown.minutes, label: "Min" },
                { val: countdown.seconds, label: "Sec" },
              ].map(({ val, label }) => (
                <div key={label} className="flex flex-col items-center min-w-[60px] sm:min-w-[80px] p-3 rounded-2xl bg-card border border-border/60 shadow-sm">
                  <span className="font-display text-3xl sm:text-4xl font-bold tabular-nums text-foreground">
                    {String(val).padStart(2, "0")}
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide font-medium">{label}</span>
                </div>
              ))}
            </div>

            <Button asChild size="lg" className="font-bold text-base px-8 shadow-xl shadow-primary/25">
              <Link to={featuredEvent.status === "open" ? `/register/${featuredEvent.id}` : "/events"}>
                {featuredEvent.status === "open" ? `Register Now for ${featuredEvent.name}` : "View All Events"}
              </Link>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* Impact stats */}
      <section id="impact" className="section-padding-sm">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-2">Impact</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2">
              Building an Entrepreneurial Culture at RKGIT
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              SPIC connects students, faculty, and industry to turn curiosity into companies and ideas into initiatives.
            </p>
          </AnimatedSection>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((s, i) => (
              <AnimatedSection
                key={s.label}
                delay={i * 0.08}
                className="text-center py-4 rounded-2xl border border-border/60 glass-card"
              >
                <div className="font-display text-3xl sm:text-4xl font-bold text-primary mb-1 glow-ring rounded-full inline-flex items-center justify-center px-4 py-1">
                  <Counter end={s.value} suffix={s.suffix} />
                </div>
                <p className="font-medium text-sm text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features / What we do */}
      <section className="section-padding border-t border-border/40">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-14">
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
              Innovation & Entrepreneurship, Reimagined
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              SPIC blends startup thinking, hands-on experimentation, and peer-led learning into one cohesive experience.
            </p>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featureCards.map((b, i) => (
              <AnimatedSection key={b.title} delay={i * 0.06}>
                <Card className="h-full group border border-border/70 glass-card hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      <b.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-semibold text-base mb-1.5">{b.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery removed as per request */}
    </main>
  );
};

export default Index;
