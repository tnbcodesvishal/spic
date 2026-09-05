import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Download,
  Search,
  ScanLine,
  RefreshCw,
  LogOut,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  FileText,
  Sparkles,
} from "lucide-react";
import { api } from "@/services/api";
import type { Event } from "@/data/events";
import Scanner from "./Scanner";
import { useToast } from "@/hooks/use-toast";
import {
  getFirebaseEvents,
  saveFirebaseEvent,
  deleteFirebaseEvent,
  subscribeToFirebaseEvents,
} from "@/services/firebaseEvents";

const ADMIN_PIN = "spic@2026";
const CATEGORIES = ["competition", "hackathon", "workshop", "talk", "seminar", "visit"] as const;
const STATUSES = ["open", "upcoming", "closed", "ended"] as const;

const formatEventDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const cleanStr = dateStr.includes("-") ? dateStr.replace(/-/g, "/") : dateStr;
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime()) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateStr.trim())) {
    return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return dateStr;
};

export default function Admin() {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(() => {
    return typeof window !== "undefined" && window.sessionStorage?.getItem("spic_admin_pin") === ADMIN_PIN;
  });
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState<"events" | "registrations" | "scanner">("events");


  // Events state
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<Event | null>(null);

  // Event form state
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    date: "",
    time: "10:00 AM onwards",
    venue: "",
    status: "open" as "open" | "upcoming" | "closed" | "ended",
    category: "competition" as "competition" | "hackathon" | "workshop" | "talk" | "seminar" | "visit",
    description: "",
    registrationType: "individual" as "individual" | "team",
    minTeamSize: 1,
    maxTeamSize: 4,
    requirePpt: false,
    whatsappGroupUrl: "",
    featured: false,
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Registrations state
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Admin stats
  const [stats, setStats] = useState<{
    totalEvents: number;
    totalRegistrations: number;
    totalParticipants: number;
    totalCheckedIn: number;
    eventStats: Record<string, { totalRegistrations: number; totalParticipants: number; checkedIn: number }>;
  } | null>(null);

  const currentPin = typeof window !== "undefined" ? window.sessionStorage?.getItem("spic_admin_pin") || ADMIN_PIN : ADMIN_PIN;

  // ─── PIN Login Handler ──────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (pin.trim() === ADMIN_PIN) {
      sessionStorage.setItem("spic_admin_pin", ADMIN_PIN);
      setAuthenticated(true);
      setPin("");
    } else {
      setAuthError("Incorrect Admin PIN. Please try again.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("spic_admin_pin");
    setAuthenticated(false);
  };

  // ─── Fetch Events & Stats ───────────────────────────────────────────
  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await getFirebaseEvents();
      setEvents(data);
    } catch (err: any) {
      console.error("[Admin] Error fetching events from Firebase:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    setRegsLoading(true);
    try {
      const data = await api.getAdminRegistrations(currentPin);
      setRegistrations(data);
      const st = await api.getAdminStats(currentPin);
      setStats(st);
    } catch (err: any) {
      console.error("[Admin] Error fetching registrations:", err);
    } finally {
      setRegsLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchEvents();
      fetchRegistrations();

      // Listen for real-time Firebase Firestore updates
      const unsubscribe = subscribeToFirebaseEvents((realtimeEvents) => {
        if (realtimeEvents && realtimeEvents.length > 0) {
          setEvents(realtimeEvents);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [authenticated]);

  // ─── Event Form Helpers ─────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      id: "",
      name: "",
      date: "",
      time: "10:00 AM onwards",
      venue: "",
      status: "open",
      category: "competition",
      description: "",
      registrationType: "individual",
      minTeamSize: 1,
      maxTeamSize: 4,
      requirePpt: false,
      whatsappGroupUrl: "",
      featured: false,
    });
    setFormError("");
    setEventModalOpen(true);
  };

  const openEditModal = (ev: Event) => {
    setEditingEvent(ev);
    setFormData({
      id: ev.id,
      name: ev.name,
      date: ev.date,
      time: ev.time || "10:00 AM onwards",
      venue: ev.venue,
      status: ev.status,
      category: ev.category,
      description: ev.description,
      registrationType: ev.registrationType || "individual",
      minTeamSize: ev.minTeamSize || 1,
      maxTeamSize: ev.maxTeamSize || 4,
      requirePpt: ev.requirePpt === true,
      whatsappGroupUrl: ev.whatsappGroupUrl || "",
      featured: ev.featured === true,
    });
    setFormError("");
    setEventModalOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim() || !formData.date.trim() || !formData.venue.trim()) {
      setFormError("Please fill in Event Title, Date, and Venue.");
      return;
    }

    setFormSaving(true);
    try {
      const saved = await saveFirebaseEvent(
        {
          ...formData,
          id: editingEvent ? editingEvent.id : formData.id,
        },
        currentPin
      );

      setEvents((prev) => {
        const idx = prev.findIndex((item) => item.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setEventModalOpen(false);
      fetchRegistrations(); // refresh stats
      toast({
        title: editingEvent ? "Event Updated" : "Event Created",
        description: `"${saved.name}" has been saved to Firebase Firestore successfully!`,
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to save event. Please check inputs.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmEvent) return;
    try {
      await deleteFirebaseEvent(deleteConfirmEvent.id, currentPin);
      setEvents((prev) => prev.filter((item) => item.id !== deleteConfirmEvent.id));
      toast({
        title: "Event Deleted",
        description: `"${deleteConfirmEvent.name}" was removed from Firebase Firestore.`,
      });
      setDeleteConfirmEvent(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleQuickStatusToggle = async (ev: Event) => {
    const nextStatus = ev.status === "open" ? "closed" : "open";
    try {
      const updated = await saveFirebaseEvent({ ...ev, status: nextStatus }, currentPin);
      setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast({
        title: "Status Updated",
        description: `"${ev.name}" is now ${nextStatus.toUpperCase()} in Firebase Firestore.`,
      });
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // ─── Resend Ticket Email ────────────────────────────────────────────
  const handleResendTicket = async (regId: string, isTeam: boolean) => {
    setResendingId(regId);
    setResendMessage(null);
    try {
      const res = await api.resendAdminTicket({ registrationId: regId, isTeam }, currentPin);
      setResendMessage(res.message || "Ticket resent successfully!");
      setTimeout(() => setResendMessage(null), 3500);
    } catch (err: any) {
      setResendMessage(`Failed: ${err.message}`);
      setTimeout(() => setResendMessage(null), 3500);
    } finally {
      setResendingId(null);
    }
  };

  // ─── Event-Tailored CSV Export ────────────────────────────────────────
  const exportToCSV = (targetEventId?: string) => {
    const targetId = targetEventId || selectedEventFilter;
    const targetEvent = targetId !== "all" ? events.find((e) => e.id === targetId) : undefined;
    
    let rowsToExport = registrations;
    if (targetId !== "all") {
      rowsToExport = registrations.filter((r) => r.eventId === targetId);
    } else {
      rowsToExport = filteredRegistrations;
    }

    if (rowsToExport.length === 0) {
      toast({
        title: "No Registrations",
        description: `There are no registrations to export for ${targetEvent ? targetEvent.name : "this selection"}.`,
      });
      return;
    }

    const hasTeams = rowsToExport.some((r) => r.type === "team");
    const hasPpt = rowsToExport.some((r) => r.pptLink);

    const headers: string[] = [
      "S.No",
      "Registration ID",
      "Event Name",
      "Event Date",
    ];

    if (hasTeams) {
      headers.push("Team Name", "Member Role");
    } else {
      headers.push("Registration Type");
    }

    headers.push(
      "Participant Name",
      "Email Address",
      "Phone Number",
      "Roll Number",
      "Branch",
      "Year"
    );

    if (hasPpt) {
      headers.push("PPT / Presentation Link");
    }

    headers.push("Checked In Status", "Checked In Time", "Registration Timestamp");

    const csvData: string[][] = [headers];
    let serialNo = 1;

    rowsToExport.forEach((r) => {
      const regTime = r.createdAt
        ? new Date(r.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      const eventDateStr = formatEventDate(r.eventDate || targetEvent?.date || "");
      const eventTitle = r.eventName || targetEvent?.name || r.eventId;

      if (r.type === "team") {
        (r.members || []).forEach((m: any, idx: number) => {
          const row: string[] = [
            String(serialNo++),
            r.id,
            eventTitle,
            eventDateStr,
            r.teamName || "",
            idx === 0 ? "Team Lead" : `Member ${idx + 1}`,
            m.name || "",
            m.email || "",
            m.phone || "",
            m.rollNumber || "",
            m.branch || "",
            m.year || "",
          ];

          if (hasPpt) {
            row.push(r.pptLink || "");
          }

          row.push(
            m.checkedIn ? "YES" : "NO",
            m.checkedInAt || "",
            regTime
          );

          csvData.push(row);
        });
      } else {
        const row: string[] = [
          String(serialNo++),
          r.id,
          eventTitle,
          eventDateStr,
          "Individual",
          r.participantName || "",
          r.participantEmail || "",
          r.phone || "N/A",
          r.rollNumber || "",
          r.branch || "",
          r.year || "",
        ];

        if (hasPpt) {
          row.push("-");
        }

        row.push(
          r.checkedIn ? "YES" : "NO",
          r.checkedInAt || "",
          regTime
        );

        csvData.push(row);
      }
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvData.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const eventSlug = targetEvent
      ? targetEvent.name.replace(/[^a-zA-Z0-9]/g, "_")
      : "All_Events";

    const fileName = `SPIC_${eventSlug}_Registrations_${new Date().toISOString().split("T")[0]}.csv`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Downloaded",
      description: `Exported "${fileName}" with ${csvData.length - 1} records.`,
    });
  };

  // ─── Filtered & Sorted Registrations (Latest First) ─────────────────
  const filteredRegistrations = useMemo(() => {
    const list = registrations.filter((r) => {
      if (selectedEventFilter !== "all" && r.eventId !== selectedEventFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      if (r.type === "team") {
        const teamMatch = (r.teamName || "").toLowerCase().includes(q);
        const memberMatch = (r.members || []).some(
          (m: any) =>
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q) ||
            (m.rollNumber || "").toLowerCase().includes(q)
        );
        return teamMatch || memberMatch;
      } else {
        return (
          (r.participantName || "").toLowerCase().includes(q) ||
          (r.participantEmail || "").toLowerCase().includes(q) ||
          (r.rollNumber || "").toLowerCase().includes(q)
        );
      }
    });

    return list.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const timeA = isNaN(dateA) ? 0 : dateA;
      const timeB = isNaN(dateB) ? 0 : dateB;
      return timeB - timeA;
    });
  }, [registrations, selectedEventFilter, searchTerm]);

  // ─── Unauthenticated Screen ─────────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="min-h-[85vh] flex items-center justify-center px-4">
        <AnimatedSection className="w-full max-w-sm">
          <Card className="border-border/60 shadow-2xl glass-card text-center overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary" />
            <CardHeader className="pt-8 pb-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 border border-primary/20">
                <Lock className="w-6 h-6" />
              </div>
              <CardTitle className="font-display text-2xl font-bold">SPIC Admin Panel</CardTitle>
              <CardDescription className="text-xs">
                Enter your administrative PIN to manage events, registrations, and QR tickets.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="pin" className="text-xs font-semibold">Admin PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="••••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="text-center tracking-widest text-lg font-mono"
                    autoFocus
                  />
                  {authError && <p className="text-xs text-destructive font-medium mt-1">{authError}</p>}
                </div>
                <Button type="submit" className="w-full font-bold shadow-md shadow-primary/20">
                  Access Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </AnimatedSection>
      </main>
    );
  }

  // ─── Authenticated Admin Dashboard ──────────────────────────────────
  return (
    <main className="min-h-screen pb-24 pt-6 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Top Header Bar */}
        <AnimatedSection className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                Admin Control Center
              </span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Firebase Firestore Live
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Dynamic Events & Attendance</h1>
          </div>


          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                fetchEvents();
                fetchRegistrations();
              }}
              disabled={eventsLoading || regsLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${eventsLoading || regsLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-destructive hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Logout
            </Button>
          </div>
        </AnimatedSection>

        {/* Global Stats Overview Cards */}
        <AnimatedSection delay={0.05} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Events</p>
                <p className="font-display text-2xl font-bold mt-1 text-foreground">{events.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Open for Reg.</p>
                <p className="font-display text-2xl font-bold mt-1 text-emerald-500">
                  {events.filter((e) => e.status === "open").length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Registrations</p>
                <p className="font-display text-2xl font-bold mt-1 text-primary">
                  {stats?.totalRegistrations || registrations.length}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Checked-in Attendance</p>
                <p className="font-display text-2xl font-bold mt-1 text-accent">
                  {stats?.totalCheckedIn || 0}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <ScanLine className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Dashboard Navigation Tabs */}
        <div className="flex gap-2 border-b border-border/60 pb-3 mb-6 overflow-x-auto">
          <Button
            size="sm"
            variant={activeTab === "events" ? "default" : "ghost"}
            onClick={() => setActiveTab("events")}
            className="text-xs font-semibold"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" /> Events Manager ({events.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "registrations" ? "default" : "ghost"}
            onClick={() => setActiveTab("registrations")}
            className="text-xs font-semibold"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" /> Registrations & Export ({registrations.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "scanner" ? "default" : "ghost"}
            onClick={() => setActiveTab("scanner")}
            className="text-xs font-semibold"
          >
            <ScanLine className="w-3.5 h-3.5 mr-1.5" /> Live Ticket Scanner
          </Button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: EVENTS MANAGER
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "events" && (
          <AnimatedSection>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-display text-lg font-bold">All Events</h2>
                <p className="text-xs text-muted-foreground">
                  Create, edit, or toggle registration forms for any event in real time.
                </p>
              </div>
              <Button onClick={openCreateModal} className="font-semibold text-xs shadow-md shadow-primary/20">
                <Plus className="w-4 h-4 mr-1.5" /> Create New Event
              </Button>
            </div>

            {eventsLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="py-16 text-center border border-dashed rounded-2xl">
                <p className="text-sm text-muted-foreground mb-4">No events found in database.</p>
                <Button onClick={openCreateModal} size="sm">Create First Event</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {events.map((ev) => {
                  const isTeam = ev.registrationType === "team";
                  const eventStats = stats?.eventStats?.[ev.id];

                  return (
                    <Card key={ev.id} className="border-border/60 glass-card flex flex-col justify-between hover:border-primary/40 transition-all">
                      <CardContent className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize ${
                                  ev.status === "open"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : ev.status === "closed"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                    : ev.status === "upcoming"
                                    ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {ev.status}
                              </Badge>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border capitalize">
                                {ev.category}
                              </span>
                              {ev.featured && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> Hero
                                </span>
                              )}
                            </div>
                            <h3 className="font-display font-bold text-base text-foreground">{ev.name}</h3>
                            <p className="text-[11px] font-mono text-muted-foreground">ID: {ev.id}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground my-3 bg-muted/20 p-3 rounded-lg border border-border/40">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{formatEventDate(ev.date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{ev.time || "10:00 AM onwards"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{ev.venue}</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30 text-foreground font-medium">
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>
                              {isTeam
                                ? `Team: ${ev.minTeamSize || 1} to ${ev.maxTeamSize || 4} members ${ev.requirePpt ? "(PPT req)" : ""}`
                                : "Individual Registration (1 person)"}
                            </span>
                          </div>
                        </div>

                        {eventStats && (
                          <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10 mb-4">
                            <span className="text-muted-foreground">Registrations:</span>
                            <span className="font-bold text-primary">
                              {eventStats.totalRegistrations} teams/members ({eventStats.checkedIn} checked-in)
                            </span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 mt-auto">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs px-2.5"
                              onClick={() => openEditModal(ev)}
                            >
                              <Edit2 className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2"
                              onClick={() => setDeleteConfirmEvent(ev)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={ev.status === "open" ? "secondary" : "default"}
                              className="h-8 text-[11px] font-semibold px-2.5"
                              onClick={() => handleQuickStatusToggle(ev)}
                            >
                              {ev.status === "open" ? "Close Reg" : "Open Reg"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs px-2"
                              asChild
                              title="Test Event Registration Form"
                            >
                              <Link to={`/register/${ev.id}`} target="_blank">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </AnimatedSection>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: REGISTRATIONS & ATTENDANCE (INDIVIDUAL PER EVENT)
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "registrations" && (
          <AnimatedSection>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-lg font-bold">Event Registrations & Attendance</h2>
                <p className="text-xs text-muted-foreground">
                  View registrations individually separated for each event, verify check-ins, and export per event.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={exportToCSV} size="sm" variant="outline" className="text-xs font-semibold">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export {selectedEventFilter === "all" ? "All Registrations" : "Selected Event"} CSV
                </Button>
              </div>
            </div>

            {/* Event Navigation Sub-Tabs (Individual Event Selector) */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-5 border-b border-border/40">
              <Button
                size="sm"
                variant={selectedEventFilter === "all" ? "default" : "outline"}
                onClick={() => setSelectedEventFilter("all")}
                className="text-xs shrink-0 font-semibold"
              >
                All Events ({registrations.length})
              </Button>
              {events.map((ev) => {
                const count = registrations.filter((r) => r.eventId === ev.id).length;
                return (
                  <Button
                    key={ev.id}
                    size="sm"
                    variant={selectedEventFilter === ev.id ? "default" : "outline"}
                    onClick={() => setSelectedEventFilter(ev.id)}
                    className="text-xs shrink-0 font-semibold"
                  >
                    {ev.name} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search participant name, roll number, email, or team name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="w-full sm:w-64">
                <select
                  value={selectedEventFilter}
                  onChange={(e) => setSelectedEventFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">View All Events ({registrations.length})</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({registrations.filter((r) => r.eventId === ev.id).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {resendMessage && (
              <div className="p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary animate-in fade-in">
                {resendMessage}
              </div>
            )}

            {regsLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading registrations...</p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="py-16 text-center border border-dashed rounded-2xl">
                <p className="text-sm text-muted-foreground">No registrations found for this selection.</p>
              </div>
            ) : selectedEventFilter !== "all" ? (
              /* Single Individual Event Registration View */
              (() => {
                const targetEv = events.find((e) => e.id === selectedEventFilter);
                const evStats = stats?.eventStats?.[selectedEventFilter];
                return (
                  <Card className="border-border/60 glass-card">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 mb-1">
                            Individual Event View
                          </Badge>
                          <CardTitle className="font-display text-xl font-bold">
                            {targetEv ? targetEv.name : selectedEventFilter}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {targetEv?.venue ? `Venue: ${targetEv.venue} • Date: ${formatEventDate(targetEv.date)}` : "Event Submissions"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground font-semibold">
                            Total Reg: {filteredRegistrations.length}
                          </span>
                          {evStats && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                              Checked In: {evStats.checkedIn}
                            </span>
                          )}
                          <Button onClick={() => exportToCSV(selectedEventFilter)} size="sm" variant="outline" className="h-8 text-xs font-semibold">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Export {targetEv ? targetEv.name : "Event"} CSV
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                            <tr>
                              <th className="py-3 px-4">Participant / Team</th>
                              <th className="py-3 px-4">Contact Details</th>
                              <th className="py-3 px-4">Academic Details</th>
                              <th className="py-3 px-4">Registered Date</th>
                              <th className="py-3 px-4">PPT File</th>
                              <th className="py-3 px-4">Check-in Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-normal">
                            {filteredRegistrations.map((r) => {
                              const isTeam = r.type === "team";
                              const isCheckedIn = isTeam
                                ? (r.members || []).some((m: any) => m.checkedIn)
                                : r.checkedIn;

                              return (
                                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="py-3.5 px-4">
                                    {isTeam ? (
                                      <div>
                                        <p className="font-bold text-foreground">{r.teamName}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Lead: {r.members?.[0]?.name} ({r.members?.length} members)
                                        </p>
                                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 bg-purple-500/10 text-purple-400">
                                          Team Registration
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="font-bold text-foreground">{r.participantName}</p>
                                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 bg-blue-500/10 text-blue-400">
                                          Individual Registration
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-3.5 px-4">
                                    <p className="text-foreground">{isTeam ? r.leadEmail || r.members?.[0]?.email : r.participantEmail}</p>
                                    <p className="text-muted-foreground text-[10px]">
                                      {isTeam ? r.members?.[0]?.phone : r.phone || "N/A"}
                                    </p>
                                  </td>

                                  <td className="py-3.5 px-4">
                                    <p className="font-mono text-foreground">
                                      {isTeam ? r.members?.[0]?.rollNumber : r.rollNumber}
                                    </p>
                                    <p className="text-muted-foreground text-[10px]">
                                      {isTeam
                                        ? `${r.members?.[0]?.branch || ""} ${r.members?.[0]?.year || ""}`
                                        : `${r.branch || ""} ${r.year || ""}`}
                                    </p>
                                  </td>

                                  <td className="py-3.5 px-4">
                                    <p className="text-foreground font-medium text-[11px] whitespace-nowrap">
                                      {r.createdAt
                                        ? new Date(r.createdAt).toLocaleString("en-IN", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : "N/A"}
                                    </p>
                                  </td>

                                  <td className="py-3.5 px-4">
                                    {r.pptLink ? (
                                      <a
                                        href={r.pptLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                                      >
                                        <FileText className="w-3 h-3" /> View Deck
                                      </a>
                                    ) : (
                                      <span className="text-muted-foreground text-[11px]">-</span>
                                    )}
                                  </td>

                                  <td className="py-3.5 px-4">
                                    {isCheckedIn ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                        <CheckCircle2 className="w-3 h-3" /> Checked In
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                                        <XCircle className="w-3 h-3" /> Absent
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-3.5 px-4 text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px] px-2"
                                      disabled={resendingId === r.id}
                                      onClick={() => handleResendTicket(r.id, isTeam)}
                                    >
                                      {resendingId === r.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : (
                                        <Mail className="w-3 h-3 mr-1" />
                                      )}
                                      Resend Ticket
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              /* All Events View - Displayed in Individual Event Blocks */
              <div className="space-y-8">
                {events.map((ev) => {
                  const evRegs = filteredRegistrations.filter((r) => r.eventId === ev.id);
                  if (evRegs.length === 0 && searchTerm.trim()) return null;

                  return (
                    <Card key={ev.id} className="border-border/60 glass-card overflow-hidden">
                      <CardHeader className="py-3.5 px-5 bg-muted/30 border-b border-border/40">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize bg-secondary">
                              {ev.category}
                            </Badge>
                            <CardTitle className="font-display text-base font-bold text-foreground">
                              {ev.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {evRegs.length} Registration{evRegs.length === 1 ? "" : "s"}
                            </span>
                            <Button onClick={() => exportToCSV(ev.id)} size="sm" variant="outline" className="h-7 text-[11px] font-semibold px-2">
                              <Download className="w-3 h-3 mr-1" /> Export CSV
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {evRegs.length === 0 ? (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            No registrations for this event yet.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-muted/20 border-b border-border/40 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                                <tr>
                                  <th className="py-2.5 px-4">Participant / Team</th>
                                  <th className="py-2.5 px-4">Contact Details</th>
                                  <th className="py-2.5 px-4">Academic Details</th>
                                  <th className="py-2.5 px-4">Registered Date</th>
                                  <th className="py-2.5 px-4">PPT File</th>
                                  <th className="py-2.5 px-4">Check-in Status</th>
                                  <th className="py-2.5 px-4 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40 font-normal">
                                {evRegs.map((r) => {
                                  const isTeam = r.type === "team";
                                  const isCheckedIn = isTeam
                                    ? (r.members || []).some((m: any) => m.checkedIn)
                                    : r.checkedIn;

                                  return (
                                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                      <td className="py-3 px-4">
                                        {isTeam ? (
                                          <div>
                                            <p className="font-bold text-foreground">{r.teamName}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                              Lead: {r.members?.[0]?.name} ({r.members?.length} members)
                                            </p>
                                          </div>
                                        ) : (
                                          <div>
                                            <p className="font-bold text-foreground">{r.participantName}</p>
                                          </div>
                                        )}
                                      </td>

                                      <td className="py-3 px-4">
                                        <p className="text-foreground">{isTeam ? r.leadEmail || r.members?.[0]?.email : r.participantEmail}</p>
                                        <p className="text-muted-foreground text-[10px]">
                                          {isTeam ? r.members?.[0]?.phone : r.phone || "N/A"}
                                        </p>
                                      </td>

                                      <td className="py-3 px-4">
                                        <p className="font-mono text-foreground">
                                          {isTeam ? r.members?.[0]?.rollNumber : r.rollNumber}
                                        </p>
                                        <p className="text-muted-foreground text-[10px]">
                                          {isTeam
                                            ? `${r.members?.[0]?.branch || ""} ${r.members?.[0]?.year || ""}`
                                            : `${r.branch || ""} ${r.year || ""}`}
                                        </p>
                                      </td>

                                      <td className="py-3 px-4">
                                        <p className="text-foreground font-medium text-[11px] whitespace-nowrap">
                                          {r.createdAt
                                            ? new Date(r.createdAt).toLocaleString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : "N/A"}
                                        </p>
                                      </td>

                                      <td className="py-3 px-4">
                                        {r.pptLink ? (
                                          <a
                                            href={r.pptLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
                                          >
                                            <FileText className="w-3 h-3" /> View Deck
                                          </a>
                                        ) : (
                                          <span className="text-muted-foreground text-[11px]">-</span>
                                        )}
                                      </td>

                                      <td className="py-3 px-4">
                                        {isCheckedIn ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                            <CheckCircle2 className="w-3 h-3" /> Checked In
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                                            <XCircle className="w-3 h-3" /> Absent
                                          </span>
                                        )}
                                      </td>

                                      <td className="py-3 px-4 text-right">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-[10px] px-2"
                                          disabled={resendingId === r.id}
                                          onClick={() => handleResendTicket(r.id, isTeam)}
                                        >
                                          {resendingId === r.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                          ) : (
                                            <Mail className="w-3 h-3 mr-1" />
                                          )}
                                          Resend Ticket
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </AnimatedSection>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: QR SCANNER
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "scanner" && (
          <AnimatedSection>
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold">QR Ticket Scanner</h2>
              <p className="text-xs text-muted-foreground">
                Scan attendee QR tickets directly via camera, image upload, or token verification.
              </p>
            </div>
            <div className="max-w-xl mx-auto">
              <Scanner skipAuth={true} />
            </div>
          </AnimatedSection>
        )}
      </div>

      {/* ─── Create / Edit Event Dialog Modal ──────────────────────────── */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              {editingEvent ? `Edit Event: ${editingEvent.name}` : "Create New Event"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure event details, schedules, and dynamic registration parameters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-4 pt-2">
            {formError && (
              <p className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
                {formError}
              </p>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Event Title *</Label>
              <Input
                placeholder="e.g. AI Innovation Hackathon 2026"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    // auto generate slug if not editing
                    id: editingEvent
                      ? prev.id
                      : val
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)/g, ""),
                  }));
                }}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Event ID / URL Slug</Label>
                <Input
                  placeholder="e.g. ai-hackathon-2026"
                  value={formData.id}
                  disabled={!!editingEvent}
                  onChange={(e) => setFormData((p) => ({ ...p, id: e.target.value }))}
                />
                <p className="text-[10px] text-muted-foreground">URL: /register/{formData.id || "slug"}</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  value={formData.category}
                  onChange={(e: any) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Event Date *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Pick from Calendar or Type Text</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={
                      formData.date && /^\d{4}-\d{2}-\d{2}$/.test(formData.date)
                        ? formData.date
                        : formData.date && !isNaN(new Date(formData.date).getTime()) && formData.date.includes("-")
                        ? new Date(formData.date).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) setFormData((p) => ({ ...p, date: val }));
                    }}
                    className="text-xs cursor-pointer"
                    title="Click to choose from visual calendar picker"
                  />
                  <Input
                    placeholder="e.g. 2026-09-25 or 25 & 27 April"
                    value={formData.date}
                    onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                    required
                    className="text-xs font-mono"
                  />
                </div>
                {formData.date && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Display Preview: <span className="font-semibold text-primary">{formatEventDate(formData.date)}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Time</Label>
                <Input
                  placeholder="e.g. 10:00 AM onwards"
                  value={formData.time}
                  onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status</Label>
                <select
                  value={formData.status}
                  onChange={(e: any) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs capitalize focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Venue *</Label>
              <Input
                placeholder="e.g. Seminar Hall, D Block"
                value={formData.venue}
                onChange={(e) => setFormData((p) => ({ ...p, venue: e.target.value }))}
                required
              />
            </div>

            {/* Registration Mode Section */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary">Registration Type</Label>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="registrationType"
                      value="individual"
                      checked={formData.registrationType === "individual"}
                      onChange={() => setFormData((p) => ({ ...p, registrationType: "individual" }))}
                    />
                    Individual (1 person)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="registrationType"
                      value="team"
                      checked={formData.registrationType === "team"}
                      onChange={() => setFormData((p) => ({ ...p, registrationType: "team" }))}
                    />
                    Team
                  </label>
                </div>
              </div>

              {formData.registrationType === "team" && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Members per Team</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.minTeamSize}
                      onChange={(e) => setFormData((p) => ({ ...p, minTeamSize: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Members per Team</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.maxTeamSize}
                      onChange={(e) => setFormData((p) => ({ ...p, maxTeamSize: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="col-span-2 pt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requirePpt"
                      checked={formData.requirePpt}
                      onChange={(e) => setFormData((p) => ({ ...p, requirePpt: e.target.checked }))}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <Label htmlFor="requirePpt" className="text-xs cursor-pointer">
                      Require Presentation / PPT Upload from teams
                    </Label>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">WhatsApp Group Invite Link (Optional)</Label>
              <Input
                placeholder="https://chat.whatsapp.com/..."
                value={formData.whatsappGroupUrl}
                onChange={(e) => setFormData((p) => ({ ...p, whatsappGroupUrl: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData((p) => ({ ...p, featured: e.target.checked }))}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="featured" className="text-xs cursor-pointer">
                Feature on Homepage Countdown hero (Next Big Event)
              </Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Event Description</Label>
              <textarea
                rows={3}
                placeholder="Provide a compelling description and instructions for participants..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEventModalOpen(false)}
                disabled={formSaving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formSaving} className="font-bold text-xs shadow-md shadow-primary/20">
                {formSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {editingEvent ? "Update in Firebase" : "Create Event in Firebase"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Modal ─────────────────────────────────── */}
      <Dialog open={!!deleteConfirmEvent} onOpenChange={(open) => !open && setDeleteConfirmEvent(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">Delete Event?</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete <strong>{deleteConfirmEvent?.name}</strong>? This will remove it from the
              website and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-center gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmEvent(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteEvent}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
