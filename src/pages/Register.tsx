import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { upcomingEvents, pastEvents, type Event } from "@/data/events";
import EventRegistrationForm from "@/components/EventRegistrationForm";
import TeamRegistrationForm from "@/components/TeamRegistrationForm";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, Users, Calendar, MapPin, Clock, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/services/api";

import { getFirebaseEvent } from "@/services/firebaseEvents";

export default function Register() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const allFallback = [...upcomingEvents, ...pastEvents];
    const localMatch = allFallback.find((e) => e.id === eventId);

    if (localMatch) {
      setEvent(localMatch);
    }

    if (eventId) {
      getFirebaseEvent(eventId)
        .then((fetched) => {
          if (isMounted && fetched) {
            setEvent(fetched);
          }
        })
        .catch((err) => {
          console.warn("[Register] Could not fetch dynamic event from Firebase, using fallback:", err.message);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  if (loading && !event) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading event details...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4 font-display">Event Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The event you are looking for does not exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  if (event.status !== "open") {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle className="capitalize">Registration {event.status}</AlertTitle>
          <AlertDescription>
            Registration for <strong>{event.name}</strong> is currently {event.status}.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-8">
          <Link to="/events">View Other Events</Link>
        </Button>
      </div>
    );
  }

  const isTeam = event.registrationType === "team";

  return (
    <main className="min-h-screen pt-4 pb-20 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl mx-auto">
        <AnimatedSection className="mb-4 sm:mb-8">
          <Link
            to="/events"
            className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors group"
          >
            <ChevronLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
            Back to Events
          </Link>
        </AnimatedSection>

        <div className="flex flex-col gap-6 w-full">
          {/* Detailed Info */}
          <div className="w-full">
            <AnimatedSection className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h1 className="font-display text-3xl sm:text-4xl font-bold">
                  {event.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <Users className="w-3.5 h-3.5" />
                  {isTeam
                    ? `Team (${event.minTeamSize || 1}-${event.maxTeamSize || 4} members)`
                    : "Individual Registration"}
                </span>
              </div>
              <div className="h-1 w-20 bg-primary rounded-full mb-6" />

              {/* Mobile Details dropdown */}
              <details className="lg:hidden">
                <summary className="text-xs font-semibold text-primary cursor-pointer hover:underline mb-4 text-center">
                  View Event Details & Schedule
                </summary>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3 mb-6 animate-in fade-in duration-300">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {event.description}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-border/50">
                    <div className="space-y-1">
                      <span className="font-bold block text-primary font-display uppercase tracking-wider">Date</span>
                      <span className="text-foreground">{event.date}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold block text-primary font-display uppercase tracking-wider">Venue</span>
                      <span className="text-foreground">{event.venue}</span>
                    </div>
                  </div>
                </div>
              </details>

              {/* Desktop Details Card */}
              <div className="hidden lg:block space-y-6">
                <p className="text-base text-muted-foreground leading-relaxed">
                  {event.description}
                </p>
                <div className="grid grid-cols-3 gap-4 p-5 rounded-2xl bg-secondary/50 border border-border shadow-inner">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </span>
                    <span className="text-sm font-medium">{event.date}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Time
                    </span>
                    <span className="text-sm font-medium">{event.time || "10:00 AM onwards"}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Venue
                    </span>
                    <span className="text-sm font-medium">{event.venue}</span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Dynamic Registration Form (Team or Individual) */}
          <div className="w-full flex justify-center">
            <div className="w-full max-w-xl">
              <AnimatedSection delay={0.2}>
                {isTeam ? (
                  <TeamRegistrationForm event={event} />
                ) : (
                  <EventRegistrationForm event={event} />
                )}
              </AnimatedSection>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
