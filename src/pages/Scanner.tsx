import { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type VerifyResult } from "@/services/api";
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  Keyboard,
  Upload,
  RefreshCw,
  Zap,
  ZapOff,
  SwitchCamera,
  History,
  UserCheck,
} from "lucide-react";

type Mode = "camera" | "upload" | "manual";

interface ScanLog {
  id: string;
  name: string;
  time: string;
  status: "approved" | "rejected";
  message: string;
}

const ADMIN_PIN = "spic@2026";
const SCANNER_ELEMENT_ID = "qr-reader";

// Audio chime generator using Web Audio API
function playSound(type: "success" | "error") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      if (navigator.vibrate) navigator.vibrate([200]);
    }
  } catch {
    // ignore audio failure
  }
}

export default function Scanner() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<number>(0);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanLog[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Destroy Scanner Safely ────────────────────────────────────
  const destroyScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    setTorchOn(false);
    setHasTorch(false);

    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // ignore clean-up errors
      }
    }
  }, []);

  // ─── Verify scanned data ───────────────────────────────────────
  const verify = useCallback(async (data: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;

    // Immediately halt scanning to avoid duplicate triggers
    await destroyScanner();

    setError("");
    setResult(null);
    setLoading(true);

    try {
      let parsed: any;
      try {
        parsed = typeof data === "string" ? JSON.parse(data.trim()) : data;
      } catch {
        throw new Error("Invalid QR format. Please scan an official SPIC ticket QR.");
      }

      if (!parsed.registrationId || !parsed.eventId || !parsed.verificationToken) {
        throw new Error("Missing ticket credentials in QR. Please scan a valid ticket.");
      }

      const res = await api.verify(parsed);
      setResult(res);
      playSound("success");

      // Record to local session scan history
      setScanHistory((prev) => [
        {
          id: Math.random().toString(36).substring(2, 7),
          name: res.participantName || "Participant",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "approved",
          message: "Attendance Marked Present",
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      const msg = err.message ?? "Verification failed.";
      setError(msg);
      playSound("error");

      setScanHistory((prev) => [
        {
          id: Math.random().toString(36).substring(2, 7),
          name: "Invalid / Used Ticket",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "rejected",
          message: msg,
        },
        ...prev.slice(0, 19),
      ]);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }, [destroyScanner]);

  // ─── Launch Camera with Intelligent Multi-device Fallback ──────
  const launchCamera = useCallback(async () => {
    await destroyScanner();
    if (!mountedRef.current) return;

    const el = document.getElementById(SCANNER_ELEMENT_ID);
    if (!el) return;
    el.innerHTML = "";

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      // Query available cameras
      let availableCameras: Array<{ id: string; label: string }> = [];
      try {
        availableCameras = await Html5Qrcode.getCameras();
        if (mountedRef.current && availableCameras.length > 0) {
          setCameras(availableCameras);
        }
      } catch {
        // Device enumeration not allowed or unavailable
      }

      // Camera config with dynamic responsive qrbox
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      // Determine camera target
      if (availableCameras.length > 0) {
        const targetIdx = selectedCameraIndex < availableCameras.length ? selectedCameraIndex : 0;
        const targetCam = availableCameras[targetIdx];
        await scanner.start(
          targetCam.id,
          config,
          (decodedText) => verify(decodedText),
          () => {}
        );
      } else {
        // Try facingMode environment first, fallback to user facing
        try {
          await scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => verify(decodedText),
            () => {}
          );
        } catch {
          await scanner.start(
            { facingMode: "user" },
            config,
            (decodedText) => verify(decodedText),
            () => {}
          );
        }
      }

      if (mountedRef.current) {
        setScanning(true);
        // Check if torch/flashlight is supported on active track
        try {
          const capabilities = scanner.getRunningTrackCapabilities() as any;
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      console.error("[scanner error]", err);
      scannerRef.current = null;
      if (!mountedRef.current) return;
      setError(
        err?.message?.includes("NotAllowed") || err?.message?.includes("Permission")
          ? "Camera permission denied. Please allow camera permissions in your browser or use Manual/Image Upload mode."
          : "Camera could not be accessed. Switch camera or use Image Upload / Manual mode."
      );
    }
  }, [destroyScanner, selectedCameraIndex, verify]);

  // ─── Switch Camera ─────────────────────────────────────────────
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const nextIdx = (selectedCameraIndex + 1) % cameras.length;
    setSelectedCameraIndex(nextIdx);
  };

  // ─── Toggle Flashlight / Torch ─────────────────────────────────
  const handleToggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !scanner.isScanning) return;
    try {
      const nextState = !torchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setTorchOn(nextState);
    } catch {
      // torch toggle failed
    }
  };

  // ─── File / Image Upload Scan ──────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setResult(null);
    setLoading(true);

    try {
      const scanner = new Html5Qrcode("qr-file-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decodedText = await scanner.scanFile(file, true);
      scanner.clear();
      await verify(decodedText);
    } catch (err: any) {
      setError("No valid QR code found in this image. Please upload a clear ticket QR image.");
      playSound("error");
      setLoading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Auto-start camera when authenticated in camera mode without active result
  useEffect(() => {
    if (authenticated && mode === "camera" && !result && !error && !loading) {
      const timer = setTimeout(() => launchCamera(), 250);
      return () => {
        clearTimeout(timer);
        destroyScanner();
      };
    }
  }, [authenticated, mode, result, error, loading, selectedCameraIndex, launchCamera, destroyScanner]);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      destroyScanner();
    };
  }, [destroyScanner]);

  const handleReset = () => {
    setResult(null);
    setError("");
    setManualInput("");
    verifyingRef.current = false;
  };

  // ─── PIN Protection Screen ─────────────────────────────────────
  if (!authenticated) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-sm border-border/60 shadow-2xl backdrop-blur-xl bg-card/90">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <ScanLine className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Admin Ticket Scanner</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Enter organizer PIN to unlock event entry verification
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Input
                type="password"
                placeholder="Enter PIN"
                className="text-center tracking-widest text-lg font-mono font-bold"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (pin === ADMIN_PIN) {
                      setAuthenticated(true);
                      setError("");
                    } else {
                      setError("Incorrect organizer PIN.");
                    }
                  }
                }}
              />
              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              <Button
                className="w-full font-bold shadow-lg"
                onClick={() => {
                  if (pin === ADMIN_PIN) {
                    setAuthenticated(true);
                    setError("");
                  } else {
                    setError("Incorrect organizer PIN.");
                  }
                }}
              >
                Unlock Scanner
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ─── Scanner Application ───────────────────────────────────────
  return (
    <main className="pb-16">
      {/* Hidden container for file scanning */}
      <div id="qr-file-reader" className="hidden" />

      {/* Header */}
      <section className="pt-8 pb-4 text-center px-4">
        <AnimatedSection className="max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20">
            <UserCheck className="w-3.5 h-3.5" />
            Official Entry Pass Verification
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Live Ticket <span className="text-gradient">Scanner</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan participant QR to automatically record attendance as Present
          </p>
        </AnimatedSection>
      </section>

      <section className="container mx-auto px-4 max-w-lg">
        {/* Mode Selector */}
        {!result && (
          <div className="grid grid-cols-3 gap-2 mb-4 bg-muted/50 p-1 rounded-xl border border-border/40">
            <Button
              size="sm"
              variant={mode === "camera" ? "default" : "ghost"}
              className="text-xs font-bold rounded-lg"
              onClick={() => {
                setError("");
                setMode("camera");
              }}
            >
              <Camera className="h-3.5 w-3.5 mr-1.5" />
              Camera
            </Button>
            <Button
              size="sm"
              variant={mode === "upload" ? "default" : "ghost"}
              className="text-xs font-bold rounded-lg"
              onClick={() => {
                destroyScanner();
                setError("");
                setMode("upload");
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload QR
            </Button>
            <Button
              size="sm"
              variant={mode === "manual" ? "default" : "ghost"}
              className="text-xs font-bold rounded-lg"
              onClick={() => {
                destroyScanner();
                setError("");
                setMode("manual");
              }}
            >
              <Keyboard className="h-3.5 w-3.5 mr-1.5" />
              Manual
            </Button>
          </div>
        )}

        {/* ─── Mode 1: Live Camera Scan ─── */}
        {mode === "camera" && (
          <AnimatedSection>
            <Card className="overflow-hidden border-border/60 shadow-2xl bg-black rounded-2xl relative">
              <CardContent className="p-0">
                <div className="relative w-full h-[360px] sm:h-[440px] bg-black overflow-hidden flex items-center justify-center">
                  <div id={SCANNER_ELEMENT_ID} className="w-full h-full object-cover" />

                  {/* Camera Controls Bar (Top Floating) */}
                  {!result && !error && !loading && (
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                      {cameras.length > 1 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2.5 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 text-xs rounded-full shadow-lg"
                          onClick={handleSwitchCamera}
                        >
                          <SwitchCamera className="w-3.5 h-3.5 mr-1.5 text-primary" />
                          Switch Camera ({selectedCameraIndex + 1}/{cameras.length})
                        </Button>
                      ) : (
                        <div />
                      )}

                      {hasTorch && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className={`h-8 w-8 p-0 rounded-full backdrop-blur-md border shadow-lg ${
                            torchOn ? "bg-amber-500 text-black border-amber-400" : "bg-black/60 text-white border-white/20"
                          }`}
                          onClick={handleToggleTorch}
                        >
                          {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Viewfinder Target Graphic */}
                  {!result && !error && scanning && !loading && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                      <div className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] relative rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {/* 4 Corner Markers */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />

                        {/* Animated Laser Scan Line */}
                        <div className="absolute left-2 right-2 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan shadow-[0_0_15px_rgba(59,130,246,0.9)]" />

                        {/* Alignment text */}
                        <div className="absolute bottom-3 inset-x-0 text-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 bg-black/60 px-2 py-0.5 rounded-full border border-white/10">
                            Point camera at ticket QR
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result & Verification Overlay */}
                  {(loading || result || error) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-lg z-30 animate-in fade-in duration-200">
                      {loading ? (
                        <div className="text-white flex flex-col items-center animate-pulse text-center">
                          <Loader2 className="h-14 w-14 animate-spin mb-4 text-primary" />
                          <p className="text-lg font-bold tracking-tight uppercase">Verifying Ticket...</p>
                          <p className="text-xs text-white/60 mt-1">Connecting to live attendance ledger</p>
                        </div>
                      ) : result?.valid ? (
                        <div className="text-center w-full max-w-sm px-2 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                          </div>

                          <h3 className="text-2xl font-black text-white tracking-tight uppercase mb-2">
                            Entry Approved
                          </h3>

                          <div className="w-full bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 space-y-1.5 text-center">
                            <p className="text-white text-lg font-bold uppercase tracking-wide truncate">
                              {result.participantName}
                            </p>
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                              {result.eventName}
                            </p>
                            <div className="pt-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 text-xs font-black tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                                Attendance: Present
                              </span>
                            </div>
                          </div>

                          <Button
                            size="lg"
                            className="mt-6 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base py-6 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                            onClick={handleReset}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Scan Next Participant
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center w-full max-w-sm px-2 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                          <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(244,63,94,0.5)]">
                            <XCircle className="h-12 w-12 text-rose-500" />
                          </div>

                          <h3 className="text-2xl font-black text-white tracking-tight uppercase mb-2">
                            {error?.toLowerCase().includes("used") || result?.error?.toLowerCase().includes("used")
                              ? "Already Checked In"
                              : "Access Denied"}
                          </h3>

                          <div className="w-full bg-rose-950/50 rounded-xl p-4 border border-rose-500/30 text-center">
                            <p className="text-rose-200 text-sm font-medium leading-relaxed">
                              {error || result?.error || "This QR code could not be verified."}
                            </p>
                          </div>

                          <Button
                            size="lg"
                            variant="destructive"
                            className="mt-6 w-full font-bold text-base py-6 rounded-xl shadow-lg transition-all active:scale-95"
                            onClick={handleReset}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <style>{`
                  @keyframes scan {
                    0%, 100% { top: 12%; opacity: 0.3; }
                    50% { top: 88%; opacity: 1; }
                  }
                  .animate-scan {
                    animation: scan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                  }
                `}</style>
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        {/* ─── Mode 2: Upload Image QR ─── */}
        {mode === "upload" && (
          <AnimatedSection>
            <Card className="border-border/60 shadow-xl bg-card">
              <CardContent className="p-6 text-center space-y-4">
                <div className="border-2 border-dashed border-primary/30 rounded-2xl p-8 hover:border-primary/60 transition-colors bg-primary/5 flex flex-col items-center justify-center">
                  <Upload className="w-12 h-12 text-primary mb-3 animate-bounce" />
                  <h3 className="font-bold text-base">Select Ticket Screenshot or Image</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Upload any photo or screenshot of a SPIC ticket QR code to scan directly.
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <Button
                    className="mt-5 font-bold shadow-md"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Choose Image File
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-semibold">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        {/* ─── Mode 3: Manual Input ─── */}
        {mode === "manual" && (
          <AnimatedSection>
            <Card className="border-border/60 shadow-xl bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold text-base">Manual Ticket Token Input</h2>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qr-data" className="text-xs">
                    Ticket QR JSON Data
                  </Label>
                  <Input
                    id="qr-data"
                    placeholder='{"registrationId":"...","eventId":"...","verificationToken":"..."}'
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                <Button
                  className="w-full font-bold shadow-md"
                  onClick={() => {
                    if (!manualInput.trim()) return;
                    verify(manualInput.trim());
                  }}
                  disabled={loading || !manualInput.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ScanLine className="h-4 w-4 mr-2" />}
                  Verify & Mark Present
                </Button>
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        {/* ─── Session Scan History ─── */}
        {scanHistory.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <History className="w-3.5 h-3.5 text-primary" />
                Session Verification Log ({scanHistory.length})
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setScanHistory([])}
              >
                Clear Log
              </Button>
            </div>

            <div className="space-y-2">
              {scanHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.status === "approved" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="font-bold truncate text-foreground">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.message}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-2">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
