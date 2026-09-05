import { useState, useRef, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/services/api";
import { CheckCircle2, Loader2, UploadCloud, File, X, ChevronRight, ChevronLeft, Users } from "lucide-react";
import type { Event } from "@/data/events";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
const BRANCH_OPTIONS = [
  "CSE", "IT", "ECE", "EEE", "ME", "CE", "AI-ML", "DS", "IOT", "CS", "Others",
] as const;

interface Props {
  event: Event;
  onSuccess?: (registration: any) => void;
}

export default function TeamRegistrationForm({ event, onSuccess }: Props) {
  const minMembers = event.minTeamSize ?? 1;
  const maxMembers = Math.max(minMembers, event.maxTeamSize ?? 4);
  const requirePpt = event.requirePpt === true;

  const [step, setStep] = useState<"team" | "members" | "upload" | "review" | "success">("team");
  const [activeMember, setActiveMember] = useState(0);
  const [pptFile, setPptFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic schema builder based on minMembers and maxMembers
  const { schema, defaultMembers } = useMemo(() => {
    const memberSchema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Enter a valid email"),
      rollNumber: z.string().min(1, "Roll number required"),
      year: z.string().min(1, "Select year"),
      branch: z.string().min(1, "Select branch"),
      phone: z.string().regex(/^[0-9]{10}$/, "10-digit phone number required"),
    });

    const optionalMemberSchema = z.object({
      name: z.string().optional().or(z.literal("")),
      email: z.string().email("Enter a valid email").optional().or(z.literal("")),
      rollNumber: z.string().optional().or(z.literal("")),
      year: z.string().optional().or(z.literal("")),
      branch: z.string().optional().or(z.literal("")),
      phone: z.string().regex(/^[0-9]{10}$/, "10-digit phone number required").optional().or(z.literal("")),
    }).superRefine((data, ctx) => {
      const fields = [data.name, data.email, data.rollNumber, data.year, data.branch, data.phone];
      const someFilled = fields.some((v) => v !== "" && v !== undefined);
      const allFilled = fields.every((v) => v !== "" && v !== undefined);
      if (someFilled && !allFilled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please complete all fields for this team member or leave them all empty",
          path: ["name"],
        });
      }
    });

    const membersArraySchema = z.array(z.any()).superRefine((members, ctx) => {
      const emails = new Set<string>();
      const phones = new Set<string>();
      let validMemberCount = 0;

      members.forEach((m: any, i: number) => {
        const isRequired = i < minMembers;
        if (isRequired) {
          if (!m.name) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name required", path: [i, "name"] });
          }
          if (!m.email || !/^\S+@\S+\.\S+$/.test(m.email)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid email required", path: [i, "email"] });
          }
          if (!m.rollNumber) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Roll number required", path: [i, "rollNumber"] });
          }
          if (!m.phone || !/^[0-9]{10}$/.test(m.phone)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "10-digit phone required", path: [i, "phone"] });
          }
        }

        if (m.name && m.email) {
          validMemberCount++;
          const email = m.email.toLowerCase().trim();
          const phone = m.phone?.trim();

          if (emails.has(email)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate email in team", path: [i, "email"] });
          }
          if (phone && phones.has(phone)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate phone in team", path: [i, "phone"] });
          }
          emails.add(email);
          if (phone) phones.add(phone);
        }
      });

      if (validMemberCount < minMembers) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Team must have at least ${minMembers} member${minMembers > 1 ? "s" : ""}`,
          path: [0, "name"],
        });
      }
    });

    const formSchema = z.object({
      teamName: z.string().min(2, "Team Name must be at least 2 characters"),
      members: membersArraySchema,
    });

    const defaults = Array.from({ length: maxMembers }, () => ({
      name: "",
      email: "",
      rollNumber: "",
      year: "",
      branch: "",
      phone: "",
    }));

    return { schema: formSchema, defaultMembers: defaults };
  }, [minMembers, maxMembers]);

  type FormValues = {
    teamName: string;
    members: Array<{
      name: string;
      email: string;
      rollNumber: string;
      year: string;
      branch: string;
      phone: string;
    }>;
  };

  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teamName: "",
      members: defaultMembers,
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "members",
  });

  const handleBack = () => {
    setError("");
    if (step === "members") {
      if (activeMember > 0) {
        setActiveMember((m) => m - 1);
      } else {
        setStep("team");
      }
    } else if (step === "upload") {
      setStep("members");
      setActiveMember(maxMembers - 1);
    } else if (step === "review") {
      setStep(requirePpt ? "upload" : "members");
    }
  };

  const handleNext = async () => {
    setError("");

    if (step === "team") {
      const isValid = await trigger("teamName");
      if (isValid) setStep("members");
      return;
    }

    if (step === "members") {
      const isRequired = activeMember < minMembers;
      if (isRequired) {
        const isValid = await trigger(`members.${activeMember}` as any);
        if (!isValid) return;
      }

      if (activeMember < maxMembers - 1) {
        setActiveMember((p) => p + 1);
      } else {
        // Finished last member
        if (requirePpt) {
          setStep("upload");
        } else {
          setStep("review");
        }
      }
    }
  };

  const uploadFile = async (): Promise<string> => {
    if (!pptFile) throw new Error("PPT / Presentation file is required.");

    setUploadProgress(10);
    const formData = new FormData();
    formData.append("file", pptFile);

    const progressInterval = setInterval(() => {
      setUploadProgress((p) => (p < 85 ? p + 5 : p));
    }, 400);

    try {
      const data = await api.registerPPT(formData);
      clearInterval(progressInterval);
      setUploadProgress(100);
      return data.url;
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      throw err;
    }
  };

  const onSubmit = async (values: FormValues) => {
    setError("");
    if (requirePpt && !pptFile) {
      setError("Please upload your presentation file before submitting.");
      return;
    }

    try {
      let pptLink = "";
      if (requirePpt && pptFile) {
        pptLink = await uploadFile();
      }

      const validMembers = values.members.filter((m) => m.name.trim() && m.email.trim());

      const result = await api.registerTeam({
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        eventVenue: event.venue,
        teamName: values.teamName.trim(),
        members: validMembers as any,
        pptLink,
      });

      setRegistration(result);
      setStep("success");
      onSuccess?.(result);
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = [".ppt", ".pptx", ".pdf"];
      const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (isValid) {
        setPptFile(file);
        setError("");
      } else {
        setError("Only .ppt, .pptx, or .pdf files are allowed.");
        setPptFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  // ─── Step 4: Success ──────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="text-center py-4 bg-background/50 rounded-2xl border border-border p-8 backdrop-blur-sm animate-in fade-in duration-500">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
        <h3 className="font-display text-2xl font-bold mb-2">Team Registered Successfully!</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Team <strong>{registration?.teamName}</strong> is registered for <strong>{event.name}</strong>.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Individual QR tickets have been sent to all registered team member email addresses.
        </p>

        {event.whatsappGroupUrl && (
          <div className="w-full mt-2 p-6 rounded-2xl bg-[#25D366]/5 border border-[#25D366]/20 mb-6 text-left">
            <p className="text-[10px] font-bold text-[#25D366] mb-1 uppercase tracking-[0.2em]">Official Group</p>
            <h4 className="text-sm font-semibold mb-1">Join the Event WhatsApp Group</h4>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Stay in touch with event organizers and receive real-time schedule updates.
            </p>
            <Button
              asChild
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white border-none font-bold shadow-md shadow-[#25D366]/20"
            >
              <a href={event.whatsappGroupUrl} target="_blank" rel="noopener noreferrer">
                Join Group Now
              </a>
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => (window.location.href = "/events")}
        >
          Explore More Events
        </Button>
      </div>
    );
  }

  // ─── Form Steps Layout ───────────────────────────────────────────
  const stepsList = [
    { id: "team", label: "Team Name" },
    { id: "members", label: `Members (${minMembers}-${maxMembers})` },
    ...(requirePpt ? [{ id: "upload", label: "Pitch Deck" }] : [{ id: "review", label: "Review" }]),
  ];

  return (
    <div className="w-full max-w-lg mx-auto bg-background/50 rounded-2xl border border-border p-4 sm:p-6 shadow-xl backdrop-blur-md">
      {/* Step Indicators */}
      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-full bg-border -z-0" />
        {stepsList.map((s, i) => {
          const stepIndex = stepsList.findIndex((st) => st.id === step);
          const isActive = step === s.id;
          const isPast = stepIndex > i;

          return (
            <div key={s.id} className="flex flex-col items-center flex-1 relative z-10">
              <div
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                    : isPast
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {isPast ? <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" /> : i + 1}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] mt-1.5 font-bold uppercase tracking-wider ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ─── Step 1: Team Name ─── */}
        {step === "team" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team Name
              </Label>
              <Input
                id="teamName"
                placeholder="e.g. Code Mavericks"
                className="h-12 text-base font-medium"
                {...register("teamName")}
              />
              {errors.teamName && (
                <p className="text-xs text-destructive font-medium">{errors.teamName.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This event allows teams of <strong>{minMembers}</strong> to <strong>{maxMembers}</strong> members.
              </p>
            </div>
          </div>
        )}

        {/* ─── Step 2: Team Members ─── */}
        {step === "members" && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            {/* Member Selector Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide justify-start sm:justify-center px-1">
              {fields.map((_, index) => {
                const isLeader = index === 0;
                const isReq = index < minMembers;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveMember(index)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                      activeMember === index
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    }`}
                  >
                    {isLeader ? "Lead ★" : `Member ${index + 1}`}
                    {!isReq && <span className="text-[9px] opacity-70 ml-1 font-normal">(Opt)</span>}
                  </button>
                );
              })}
            </div>

            {/* Member Form Fields */}
            {fields.map((field, index) => {
              const isLeader = index === 0;
              const isReq = index < minMembers;

              return (
                <div key={field.id} className={`space-y-3.5 ${activeMember === index ? "block" : "hidden"}`}>
                  <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {isLeader ? "Team Leader (Member 1)" : `Team Member ${index + 1}`}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isReq ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {isReq ? "Required" : "Optional"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Full Name</Label>
                    <Input placeholder="Full Name" {...register(`members.${index}.name` as const)} />
                    {errors.members?.[index]?.name && (
                      <p className="text-xs text-destructive">{errors.members[index]?.name?.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" placeholder="student@rkgit.edu.in" {...register(`members.${index}.email` as const)} />
                      {errors.members?.[index]?.email && (
                        <p className="text-xs text-destructive">{errors.members[index]?.email?.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone Number</Label>
                      <Input type="tel" placeholder="10-digit mobile" {...register(`members.${index}.phone` as const)} />
                      {errors.members?.[index]?.phone && (
                        <p className="text-xs text-destructive">{errors.members[index]?.phone?.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">University Roll Number</Label>
                    <Input placeholder="e.g. 2100270100001" {...register(`members.${index}.rollNumber` as const)} />
                    {errors.members?.[index]?.rollNumber && (
                      <p className="text-xs text-destructive">{errors.members[index]?.rollNumber?.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Year</Label>
                      <select
                        {...register(`members.${index}.year` as const)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select Year</option>
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      {errors.members?.[index]?.year && (
                        <p className="text-xs text-destructive">{errors.members[index]?.year?.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Branch</Label>
                      <select
                        {...register(`members.${index}.branch` as const)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select Branch</option>
                        {BRANCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {errors.members?.[index]?.branch && (
                        <p className="text-xs text-destructive">{errors.members[index]?.branch?.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Step 3: PPT Upload (if required) ─── */}
        {step === "upload" && requirePpt && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1 mb-2">
              <h4 className="font-semibold text-base">Upload Presentation File</h4>
              <p className="text-xs text-muted-foreground">Upload your project deck or idea pitch in PPT, PPTX, or PDF format.</p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                pptFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ppt,.pptx,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {!pptFile ? (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloud className="h-10 w-10 text-muted-foreground" />
                  <p className="text-xs sm:text-sm font-medium">Click to browse presentation file</p>
                  <p className="text-[11px] text-muted-foreground">PPT, PPTX or PDF (Max 50MB)</p>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-card p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3 truncate">
                    <File className="h-8 w-8 text-primary shrink-0" />
                    <div className="text-left truncate">
                      <p className="text-xs font-bold truncate">{pptFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(pptFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPptFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 3b: Review (if no PPT) ─── */}
        {step === "review" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Team Name</p>
                <p className="font-bold text-base">{getValues("teamName")}</p>
              </div>
              <div className="border-t border-border/50 pt-2 space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Members to Register:</p>
                {getValues("members")
                  .filter((m) => m.name && m.email)
                  .map((m, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-border/20">
                      <div>
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-muted-foreground ml-1.5 font-mono">({m.rollNumber})</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{idx === 0 ? "Team Leader" : `Member ${idx + 1}`}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2 font-medium">
            {error}
          </p>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
          {step !== "team" && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 text-xs"
              onClick={handleBack}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          )}

          {(step === "team" || step === "members") && (
            <Button
              type="button"
              className={`font-semibold text-xs ${step === "team" ? "w-full" : "flex-1"}`}
              onClick={handleNext}
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}

          {(step === "upload" || step === "review") && (
            <Button
              type="submit"
              disabled={isSubmitting || (requirePpt && !pptFile)}
              className="flex-1 font-bold text-xs shadow-md shadow-primary/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {uploadProgress > 0 && uploadProgress < 100
                    ? `Uploading ${Math.round(uploadProgress)}%`
                    : "Registering..."}
                </>
              ) : (
                "Complete Registration"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
