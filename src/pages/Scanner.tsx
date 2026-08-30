import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
} from "lucide-react";

type Mode = "camera" | "manual";

const ADMIN_PIN = "spic@2026";
const SCANNER_ELEMENT_ID = "qr-reader";

export default function Scanner() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [scanning, setScanning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);

  // ─── Verify scanned data ───────────────────────────────────────
  const verify = async (data: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    
    // STOP CAMERA IMMEDIATELY TO PREVENT DOUBLE-SCANS
    await destroyScanner();
    
    setError("");
    setResult(null);
    setLoading(true);

    try {
      let parsed: any;
      try {
        parsed = typeof data === "string" ? JSON.parse(data.trim()) : data;
      } catch {
        throw new Error("Invalid QR code format. Please scan a valid SPIC ticket.");
      }

      if (!parsed.registrationId || !parsed.eventId || !parsed.verificationToken) {
        throw new Error("Invalid QR code. Please scan a valid SPIC ticket.");
      }
      
      const res = await api.verify(parsed);
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? "Verification failed.");
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  // ─── Camera start/stop ─────────────────────────────────────────
  const destroyScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      // ignore cleanup errors
    }
    setScanning(false);
  };

  const launchCamera = async () => {
    // Always tear down any previous instance first
    await destroyScanner();

    if (!mountedRef.current) return;
    const el = document.getElementById(SCANNER_ELEMENT_ID);
    if (!el) return;

    // Clear leftover children from previous instance
    el.innerHTML = "";

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      const qrboxSize = 250;

      await scanner.start(
        { facingMode: "environment" },
        { 
          fps: 15, 
          qrbox: { width: qrboxSize, height: qrboxSize }
        },
        (decodedText) => verify(decodedText),
        () => {}
      );
      if (mountedRef.current) setScanning(true);
    } catch (err: any) {
      console.error("[scanner]", err);
      scannerRef.current = null;
      if (!mountedRef.current) return;
      setError(
        err?.message?.includes("NotAllowed") || err?.message?.includes("Permission")
          ? "Camera access denied. Allow camera permissions or use Manual Input mode."
          : "Could not start camera. Try Manual Input mode."
      );
    }
  };

  // Auto-start camera when conditions are right
  useEffect(() => {
    // Only launch if authenticated, in camera mode, AND no overlay is active
    if (authenticated && mode === "camera" && !result && !error && !loading) {
      const timer = setTimeout(() => launchCamera(), 300);
      return () => {
        clearTimeout(timer);
        destroyScanner();
      };
    }
    // If we have a result, error, or are loading, we explicitly do NOT want the camera running
  }, [authenticated, mode, result, error, loading]);

  // Track mount state & cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      destroyScanner();
    };
  }, []);

  const handleManualVerify = () => {
    if (!manualInput.trim()) return;
    verify(manualInput.trim());
  };

  const handleReset = () => {
    setResult(null);
    setError("");
    setManualInput("");
    verifyingRef.current = false;
    // The useEffect will automatically re-launch camera because !result and !error will be true
  };

  const handleStartCamera = () => {
    setError("");
    setMode("camera");
  };

  // ─── PIN Gate ──────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main>
        <section className="section-padding text-center px-4">
          <div className="max-w-sm mx-auto">
            <h1 className="font-display text-2xl font-bold mb-2">Admin Scanner</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter the organizer PIN to access the ticket scanner.
            </p>
            <Input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pin === ADMIN_PIN) {
                    setAuthenticated(true);
                    setError("");
                  } else {
                    setError("Incorrect PIN.");
                  }
                }
              }}
            />
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
            <Button
              className="w-full mt-3"
              onClick={() => {
                if (pin === ADMIN_PIN) {
                  setAuthenticated(true);
                  setError("");
                } else {
                  setError("Incorrect PIN.");
                }
              }}
            >
              Access Scanner
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // ─── Scanner UI ────────────────────────────────────────────────
  return (
    <main>
      {/* Hero */}
      <section className="section-padding text-center px-4">
        <AnimatedSection className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-gradient">Ticket</span> Scanner
          </h1>
          <p className="text-base text-muted-foreground">
            Scan participant QR tickets at the event entrance
          </p>
        </AnimatedSection>
      </section>

      <section className="section-padding-sm border-t border-border/40">
        <div className="container mx-auto px-4 max-w-lg">
          {/* Result display */}

          {/* Result display is now handled by the camera overlay */}

          {/* Mode toggle */}
          {!result && (
            <div className="flex gap-2 mb-6">
              <Button
                size="sm"
                variant={mode === "camera" ? "default" : "ghost"}
                onClick={handleStartCamera}
              >
                <Camera className="h-4 w-4 mr-1.5" />
                Camera Scan
              </Button>
              <Button
                size="sm"
                variant={mode === "manual" ? "default" : "ghost"}
                onClick={() => { destroyScanner(); setMode("manual"); setError(""); }}
              >
                <Keyboard className="h-4 w-4 mr-1.5" />
                Manual Input
              </Button>
            </div>
          )}

          {/* Main Scanner Container */}
          {mode === "camera" && (
            <AnimatedSection>
              <Card className="overflow-hidden border-none shadow-2xl">
                <CardContent className="p-0 space-y-0">
                  <div className="relative w-full overflow-hidden bg-black h-[350px] sm:h-[500px] sm:aspect-square">
                    <div
                      id={SCANNER_ELEMENT_ID}
                      className="w-full h-full"
                    />
                    
                    {/* Overlay for results and loading */}
                    {(loading || result || error) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-md z-30 animate-in fade-in duration-300">
                        {loading ? (
                          <div className="text-white flex flex-col items-center animate-pulse">
                            <Loader2 className="h-16 w-16 animate-spin mb-4 text-primary" />
                            <p className="text-xl font-bold tracking-tight uppercase">Verifying...</p>
                          </div>
                        ) : result?.valid ? (
                          <div className="text-center w-full animate-in zoom-in duration-500 px-2 flex flex-col items-center justify-center h-full">
                            <CheckCircle2 className="h-16 w-16 sm:h-28 sm:w-28 text-green-500 mx-auto mb-3 sm:mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.6)]" />
                            <h3 className="text-xl sm:text-3xl font-black text-white mb-2 sm:mb-4 tracking-tighter">ENTRY APPROVED</h3>
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 sm:p-5 border border-white/20 inline-block w-full max-w-[220px] sm:max-w-[320px]">
                              <p className="text-white text-base sm:text-xl font-bold uppercase tracking-widest truncate">{result.participantName}</p>
                              <p className="text-white/70 text-[10px] sm:text-xs font-bold uppercase mt-1 tracking-tighter">{result.eventName}</p>
                              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] sm:text-xs font-black tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-0.5" />
                                Attendance: Present
                              </div>
                            </div>
                            <Button 
                              size="lg" 
                              className="mt-6 sm:mt-12 bg-green-500 hover:bg-green-600 text-white px-6 sm:px-14 py-4 sm:py-8 text-base sm:text-xl font-black rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] transition-all active:scale-95 w-full max-w-[220px] sm:max-w-none"
                              onClick={handleReset}
                            >
                              SCAN NEXT
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center w-full animate-in zoom-in duration-300 px-2 flex flex-col items-center justify-center h-full">
                            <div className="bg-red-600 p-4 sm:p-8 rounded-[1.2rem] sm:rounded-[2.5rem] border-2 sm:border-4 border-white shadow-[0_0_60px_rgba(220,38,38,0.7)] w-full max-w-[240px] sm:max-w-[320px] mx-auto">
                              <XCircle className="h-12 w-12 sm:h-20 sm:w-20 text-white mx-auto mb-3 sm:mb-6" />
                              <h3 className="text-xl sm:text-3xl font-black text-white mb-1 sm:mb-4 leading-none tracking-tighter uppercase">
                                {error?.includes("used") || result?.error?.includes("used") ? "ALREADY USED" : "ACCESS DENIED"}
                              </h3>
                              <p className="text-white/95 text-sm sm:text-lg font-bold leading-tight line-clamp-2">
                                {error || result?.error || "Verification failed."}
                              </p>
                            </div>
                            <Button 
                              size="lg" 
                              className="mt-6 sm:mt-10 bg-white text-red-600 hover:bg-neutral-100 px-6 sm:px-14 py-4 sm:py-8 text-base sm:text-xl font-black rounded-full shadow-2xl transition-all active:scale-95 w-full max-w-[220px] sm:max-w-none"
                              onClick={handleReset}
                            >
                              TRY AGAIN
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scanning indicator (only when scanning) */}
                    {!result && !error && scanning && !loading && (
                      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
                        
                        {/* Viewfinder Frame */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                          {/* Corner Accents */}
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                          
                          {/* Animated Scan Line - now restricted to the box */}
                          <div className="absolute left-2 right-2 h-1 bg-primary/80 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan" style={{ top: '15%' }} />
                          
                          {/* Inner Hint */}
                          <div className="absolute inset-0 flex items-end justify-center pb-4">
                            <p className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Align QR Code</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <style>{`
                    @keyframes scan {
                      0%, 100% { top: 10%; opacity: 0.3; }
                      50% { top: 90%; opacity: 1; }
                    }
                  `}</style>
                </CardContent>
              </Card>
            </AnimatedSection>
          )}

          {/* Manual input */}
          {!result && mode === "manual" && (
            <AnimatedSection>
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ScanLine className="h-5 w-5 text-primary" />
                    <h2 className="font-display font-semibold">
                      Paste QR Data
                    </h2>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Paste the QR code content (JSON) from the participant's
                    ticket.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="qr-data">QR Content</Label>
                    <Input
                      id="qr-data"
                      placeholder='{"registrationId":"...","eventId":"...","verificationToken":"..."}'
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleManualVerify}
                    disabled={loading || !manualInput.trim()}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ScanLine className="h-4 w-4 mr-2" />
                    )}
                    Verify Ticket
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>
          )}
        </div>
      </section>
    </main>
  );
}
