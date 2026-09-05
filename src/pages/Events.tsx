import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { upcomingEvents as fallbackUpcoming, pastEvents as fallbackPast, type Event } from "@/data/events";
import { Calendar, MapPin, Users, Mic, Clock, Loader2, Sparkles } from "lucide-react";
import EventGallery from "@/components/EventGallery";
import { api } from "@/services/api";
import { getFirebaseEvents, subscribeToFirebaseEvents } from "@/services/firebaseEvents";

type Filter = "all" | "upcoming" | "past";

const statusColors: Record<string, string> = {
  open: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  closed: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  upcoming: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  ended: "bg-muted text-muted-foreground",
};

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const cleanStr = dateStr.includes("-") ? dateStr.replace(/-/g, "/") : dateStr;
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime()) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr.trim())) {
    return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return dateStr;
};

const EventCard = ({ event }: { event: Event }) => {
  const isTeam = event.registrationType === "team";

  return (
    <Card className="h-full group border border-border/70 glass-card hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base group-hover:text-primary transition-colors">
              {event.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border capitalize">
                {event.category || "Event"}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20">
                {isTeam ? `Team (${event.minTeamSize || 1}-${event.maxTeamSize || 4})` : "Individual"}
              </span>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${statusColors[event.status] ?? ""}`}>
            {event.status === "open" ? "Open" : event.status === "closed" ? "Closed" : event.status === "upcoming" ? "Coming Soon" : "Ended"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-3 mt-1">
          {event.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              {formatEventDate(event.date)}
            </span>
          )}
          {event.time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary" />
              {event.time}
            </span>
          )}
          {event.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              {event.venue}
            </span>
          )}
          {event.attendees && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.attendees}+
            </span>
          )}
          {event.speakers && (
            <span className="flex items-center gap-1">
              <Mic className="h-3 w-3" />
              {event.speakers} speakers
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
          {event.description}
        </p>

        <div className="pt-2 border-t border-border/40 mt-auto">
          {event.status === "open" ? (
            <Button size="sm" asChild className="w-full font-semibold shadow-sm">
              <Link to={`/register/${event.id}`}>Register Now</Link>
            </Button>
          ) : event.status === "ended" ? (
            <EventGallery eventId={event.id} eventName={event.name} imageList={event.imageList} />
          ) : (
            <div className="inline-flex items-center justify-center rounded-md text-xs font-bold h-9 px-4 py-2 bg-primary/10 text-primary border border-primary/20 shadow-sm w-full">
              Registration {event.status === "closed" ? "Closed" : "Coming Soon"}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Events = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<Event[]>([...fallbackUpcoming, ...fallbackPast]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getFirebaseEvents()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setEvents(data);
        }
      })
      .catch((err) => {
        console.warn("[Events] Fallback to local events data:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Real-time listener from Firebase Firestore
    const unsubscribe = subscribeToFirebaseEvents((realtimeEvents) => {
      if (isMounted && realtimeEvents && realtimeEvents.length > 0) {
        setEvents(realtimeEvents);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const upcoming = events.filter((e) => e.status !== "ended");
  const past = events.filter((e) => e.status === "ended");

  return (
    <main>
      <section className="section-padding text-center px-4">
        <AnimatedSection className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 border border-primary/20">
            <Sparkles className="w-3.5 h-3.5" /> Empowering Innovators
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Events by <span className="text-gradient">SPIC</span>
          </h1>
          <p className="text-base text-muted-foreground">Where Innovation Meets Action</p>
        </AnimatedSection>
      </section>

      <section className="section-padding-sm border-t border-border/40">
        <div className="container mx-auto px-4">
          {/* Filter */}
          <div className="flex gap-2 mb-10 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(["all", "upcoming", "past"] as Filter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "ghost"}
                  onClick={() => setFilter(f)}
                  className="capitalize text-xs font-semibold"
                >
                  {f} {f === "upcoming" ? `(${upcoming.length})` : f === "past" ? `(${past.length})` : `(${events.length})`}
                </Button>
              ))}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Updating events...
              </div>
            )}
          </div>

          {/* Upcoming */}
          {(filter === "all" || filter === "upcoming") && (
            <div className="mb-16">
              <AnimatedSection>
                <h2 className="font-display text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
                  <span>Upcoming & Open Events</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                    {upcoming.length}
                  </span>
                </h2>
              </AnimatedSection>
              {upcoming.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl text-muted-foreground text-sm">
                  No upcoming events right now. Check back soon!
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {upcoming.map((e, i) => (
                    <AnimatedSection key={e.id} delay={i * 0.05}>
                      <EventCard event={e} />
                    </AnimatedSection>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past */}
          {(filter === "all" || filter === "past") && (
            <div>
              <AnimatedSection>
                <h2 className="font-display text-xl sm:text-2xl font-bold mb-1.5 flex items-center gap-2">
                  <span>Past Events</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                    {past.length}
                  </span>
                </h2>
                <p className="text-muted-foreground text-sm mb-6">Relive the Moments</p>
              </AnimatedSection>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {past.map((e, i) => (
                  <AnimatedSection key={e.id} delay={i * 0.04}>
                    <EventCard event={e} />
                  </AnimatedSection>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default Events;
