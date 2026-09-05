import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Registration } from "@/services/api";
import { saveFirebaseRegistration } from "@/services/firebaseRegistrations";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Event } from "@/data/events";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
const BRANCH_OPTIONS = [
  "CSE", "IT", "ECE", "EEE", "ME", "CE", "AI/ML", "DS", "IOT", "CS","Others",
] as const;

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  rollNumber: z.string().min(1, "Roll number is required"),
  year: z.string().min(1, "Select your year"),
  branch: z.string().min(1, "Select your branch"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  event: Event;
  onSuccess?: (registration: Registration) => void;
}

export default function EventRegistrationForm({ event, onSuccess }: Props) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError("");
    try {
      const result = await api.register({
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        eventVenue: event.venue,
        name: values.name,
        email: values.email,
        phone: values.phone,
        rollNumber: values.rollNumber,
        year: values.year,
        branch: values.branch,
      });

      // Fire background Firestore save without blocking success UI
      saveFirebaseRegistration({
        ...result,
        phone: values.phone || "",
        rollNumber: values.rollNumber,
        year: values.year,
        branch: values.branch,
      }).catch((fbErr: any) => {
        console.warn("[Registration] Firestore direct write note:", fbErr.message);
      });

      setRegistration(result);
      setStep("success");
      onSuccess?.(result);
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    }
  };

  if (step === "success") {
    return (
      <div className="text-center py-4 bg-background/50 rounded-2xl border border-border p-8 backdrop-blur-sm animate-in fade-in duration-500">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
        <h3 className="font-display text-lg font-semibold mb-1">
          Registration Successful!
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your QR ticket has been sent to{" "}
          <strong>{registration?.participantEmail}</strong>.
        </p>

        {registration?.qrDataUrl && (
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white rounded-xl shadow-lg">
                <img
                src={registration.qrDataUrl}
                alt="QR Ticket"
                className="w-48 h-48 rounded-md border border-border"
                />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-4">
          Present this QR code at the event entrance for scanning.
        </p>

        <div className="flex flex-col gap-3 justify-center items-center">
            {event.whatsappGroupUrl && (
              <div className="w-full mt-2 p-6 rounded-2xl bg-[#25D366]/5 border border-[#25D366]/20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <p className="text-[10px] font-bold text-[#25D366] mb-2 uppercase tracking-[0.2em]">
                  Stay Updated
                </p>
                <h4 className="text-sm font-semibold mb-2">Join the WhatsApp Group</h4>
                <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                  Get the latest updates, event schedules, and important announcements directly on your phone.
                </p>
                <Button 
                  asChild
                  className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none shadow-lg shadow-[#25D366]/20 font-bold"
                >
                  <a href={event.whatsappGroupUrl} target="_blank" rel="noopener noreferrer">
                    Join Group Now
                  </a>
                </Button>
              </div>
            )}

            <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground text-sm"
                onClick={() => window.location.href = "/"}
            >
                Back to Home
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-background/50 rounded-2xl border border-border p-4 sm:p-6 shadow-xl backdrop-blur-md">
      <div className="mb-6 text-center sm:text-left">
        <h2 className="font-display text-lg sm:text-xl font-bold">Register for {event.name}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Fill in your details to receive your QR ticket via email.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Full Name</Label>
          <Input
            id="reg-name"
            placeholder="Your full name"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-roll">Roll Number</Label>
          <Input
            id="reg-roll"
            placeholder="e.g. 2024CSE001"
            {...register("rollNumber")}
          />
          {errors.rollNumber && (
            <p className="text-xs text-destructive">{errors.rollNumber.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reg-year">Year</Label>
            <select
              id="reg-year"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              {...register("year")}
              defaultValue=""
            >
              <option value="" disabled>Select year</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {errors.year && (
              <p className="text-xs text-destructive">{errors.year.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-branch">Branch</Label>
            <select
              id="reg-branch"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              {...register("branch")}
              defaultValue=""
            >
              <option value="" disabled>Select branch</option>
              {BRANCH_OPTIONS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.branch && (
              <p className="text-xs text-destructive">{errors.branch.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-phone">Phone (optional)</Label>
          <Input
            id="reg-phone"
            type="tel"
            placeholder="Your phone number"
            {...register("phone")}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-10 sm:h-11 font-bold text-sm sm:text-base"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Registering…
            </>
          ) : (
            "Register & Get Ticket"
          )}
        </Button>
      </form>
    </div>
  );
}
