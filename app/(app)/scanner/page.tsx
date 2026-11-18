"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Zap,
  ZapOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  History,
  Search,
  Sparkles,
  Loader2,
  Play,
  Pause,
  X,
  ArrowRightLeft,
  Smartphone,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

interface ScanResult {
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  message: string;
  eventType?: string;
  targetInLibrary?: 0 | 1;
  student?: {
    id?: string;
    fullName: string;
    rollNumber: string;
    category: string;
    department: string;
    inLibrary: 0 | 1;
  };
  reasonCode?: string;
  timestamp: string;
  checkpointName?: string;
}

const CHECKPOINTS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Main Gate (Both Entry & Exit)", type: "LIBRARY_BOTH" },
  { id: "22222222-2222-2222-2222-222222222222", name: "North Turnstile (Entry Only)", type: "LIBRARY_ENTRY" },
  { id: "33333333-3333-3333-3333-333333333333", name: "South Turnstile (Exit Only)", type: "LIBRARY_EXIT" },
];

export default function MobileScannerView() {
  // Navigation & View Mode on Mobile
  const [activeTab, setActiveTab] = useState<"camera" | "manual" | "history">("camera");

  // Scanner Configuration
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(CHECKPOINTS[0].id);
  const [scanMode, setScanMode] = useState<"AUTO" | "ENTRY_ONLY" | "EXIT_ONLY">("AUTO");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Manual Inputs
  const [rollInput, setRollInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // Scan Results & History
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [counters, setCounters] = useState({
    entries: 0,
    exits: 0,
    rejections: 0,
  });

  // Device Camera States
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "active" | "error" | "stopped">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [isPaused, setIsPaused] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [reticleFlash, setReticleFlash] = useState<"none" | "green" | "red" | "amber">("none");

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Debounce Refs
  const lastScannedPayloadRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  // Sound synthesis via Web Audio API (zero external assets needed)
  const playSound = useCallback((type: "ACCEPTED" | "DUPLICATE" | "REJECTED") => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "ACCEPTED") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === "DUPLICATE") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch {}
  }, [soundEnabled]);

  // Haptic feedback
  const triggerHaptic = useCallback((type: "ACCEPTED" | "DUPLICATE" | "REJECTED") => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        if (type === "ACCEPTED") {
          navigator.vibrate(120);
        } else if (type === "DUPLICATE") {
          navigator.vibrate([80, 50, 80]);
        } else {
          navigator.vibrate([150, 60, 200]);
        }
      } catch {}
    }
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    videoTrackRef.current = null;
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start device camera
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    stopCamera();
    setCameraStatus("requesting");
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("error");
      setCameraError("Camera API is not supported in this browser environment. Use Manual Entry.");
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback to basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      videoTrackRef.current = track;

      // Check torch capability
      try {
        const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : null;
        setHasTorch(Boolean(capabilities?.torch));
      } catch {}

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraStatus("active");
        setIsPaused(false);
      }
    } catch (err: any) {
      setCameraStatus("error");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser site settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device was detected on your hardware.");
      } else {
        setCameraError(err.message || "Failed to initialize device camera stream.");
      }
    }
  }, [stopCamera]);

  // Handle switching camera (back vs front)
  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!videoTrackRef.current || !hasTorch) return;
    try {
      const nextTorch = !isTorchOn;
      await (videoTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch {}
  };

  // Toggle Camera Pause/Resume
  const togglePause = () => {
    if (isPaused) {
      videoRef.current?.play().catch(() => {});
      setIsPaused(false);
    } else {
      videoRef.current?.pause();
      setIsPaused(true);
    }
  };

  // Initial camera mount
  useEffect(() => {
    if (activeTab === "camera") {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab, startCamera, cameraFacing, stopCamera]);

  // Core API Submission Handler
  const handleScanSubmit = async (payload: { rollNumber?: string; token?: string }) => {
    setIsScanning(true);
    try {
      const activeCp = CHECKPOINTS.find((c) => c.id === selectedCheckpoint) || CHECKPOINTS[0];
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: selectedCheckpoint,
          mode: scanMode,
          rollNumber: payload.rollNumber || undefined,
          token: payload.token || undefined,
        }),
      });

      const data = await res.json();
      const status: "ACCEPTED" | "DUPLICATE" | "REJECTED" = data.status || "REJECTED";

      const result: ScanResult = {
        status,
        message: data.message || (status === "ACCEPTED" ? "Movement verified" : "Scan rejected"),
        eventType: data.eventType,
        targetInLibrary: data.targetInLibrary,
        student: data.student,
        reasonCode: data.reasonCode,
        checkpointName: activeCp.name,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 24)]);

      // Audio & Vibration Feedback
      playSound(status);
      triggerHaptic(status);

      // Flash Reticle
      setReticleFlash(status === "ACCEPTED" ? "green" : status === "DUPLICATE" ? "amber" : "red");
      setTimeout(() => setReticleFlash("none"), 1200);

      // Counters
      if (status === "ACCEPTED") {
        if (result.eventType === "LIBRARY_ENTRY") {
          setCounters((c) => ({ ...c, entries: c.entries + 1 }));
        } else {
          setCounters((c) => ({ ...c, exits: c.exits + 1 }));
        }
      } else {
        setCounters((c) => ({ ...c, rejections: c.rejections + 1 }));
      }
    } catch (err: any) {
      const errorResult: ScanResult = {
        status: "REJECTED",
        message: err.message || "Network communication failed. Please retry.",
        reasonCode: "NETWORK_ERROR",
        timestamp: new Date().toLocaleTimeString(),
      };
      setLastResult(errorResult);
      playSound("REJECTED");
      triggerHaptic("REJECTED");
      setReticleFlash("red");
      setTimeout(() => setReticleFlash("none"), 1200);
    } finally {
      setIsScanning(false);
      setRollInput("");
    }
  };

  // Parse any raw string scanned by camera (token, URL, JSON, or roll number)
  const parseScannedPayload = (raw: string): { token?: string; rollNumber?: string } => {
    const trimmed = raw.trim();

    // 1. JSON string
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.token) return { token: parsed.token };
        if (parsed.rollNumber) return { rollNumber: parsed.rollNumber };
      } catch {}
    }

    // 2. URL format
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const url = new URL(trimmed);
        const tokenParam = url.searchParams.get("token");
        if (tokenParam) return { token: tokenParam };
        const rollParam = url.searchParams.get("roll") || url.searchParams.get("rollNumber");
        if (rollParam) return { rollNumber: rollParam };
      } catch {}
    }

    // 3. Rotating token (starts with v1.)
    if (trimmed.startsWith("v1.")) {
      return { token: trimmed };
    }

    // 4. Clean Roll number (e.g. 23CS1001)
    if (/^[0-9]{2}[A-Za-z]{2,4}[0-9]{3,5}$/i.test(trimmed)) {
      return { rollNumber: trimmed.toUpperCase() };
    }

    return { token: trimmed };
  };

  // Continuous Camera QR Code Scanner Frame Loop
  useEffect(() => {
    let animId: number;

    const scanFrame = () => {
      if (
        activeTab === "camera" &&
        cameraStatus === "active" &&
        !isPaused &&
        videoRef.current &&
        videoRef.current.readyState >= 2 // HAVE_CURRENT_DATA
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data && code.data.trim()) {
              const scannedText = code.data.trim();
              const now = Date.now();

              // Debounce 3.5 seconds on identical QR code payload
              if (
                lastScannedPayloadRef.current === scannedText &&
                now - lastScannedTimeRef.current < 3500
              ) {
                // Duplicate scan in quick succession: skip
              } else {
                lastScannedPayloadRef.current = scannedText;
                lastScannedTimeRef.current = now;

                const parsed = parseScannedPayload(scannedText);
                handleScanSubmit(parsed);
              }
            }
          }
        }
      }
      animId = requestAnimationFrame(scanFrame);
    };

    animId = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animId);
  }, [activeTab, cameraStatus, isPaused, selectedCheckpoint, scanMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollInput.trim()) return;
    handleScanSubmit({ rollNumber: rollInput.trim() });
  };

  return (
    <div className="min-h-screen bg-bg text-whitesmoke flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Mobile Bar */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-border px-3.5 py-2.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent text-bg flex items-center justify-center font-bold shadow-md shadow-accent/20">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-whitesmoke leading-tight">Checkpoint Scanner</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${cameraStatus === "active" && !isPaused ? "bg-green-400 animate-pulse" : "bg-ash"}`} />
              <p className="text-[10px] text-ash font-medium">
                {cameraStatus === "active" ? (isPaused ? "Camera Paused" : "Live Camera Ready") : "Ready"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Header */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-surface-raised border border-border text-ash hover:text-whitesmoke active:scale-95 transition-all"
            title={soundEnabled ? "Mute audio" : "Enable sound"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <Link
            href="/admin/dashboard"
            className="px-2.5 py-1.5 rounded-lg bg-surface-raised border border-border text-[11px] font-semibold text-sand hover:text-whitesmoke active:scale-95 transition-all"
          >
            Admin View
          </Link>
        </div>
      </header>

      {/* Mobile Top Controls: Checkpoint & Direction Selector */}
      <div className="bg-surface border-b border-border px-3.5 py-2.5 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Checkpoint selector */}
          <div className="flex-1">
            <select
              value={selectedCheckpoint}
              onChange={(e) => setSelectedCheckpoint(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs font-semibold text-whitesmoke focus:outline-none focus:border-accent"
            >
              {CHECKPOINTS.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  📍 {cp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Pill Toggle (Touch-Friendly) */}
          <div className="grid grid-cols-3 bg-bg p-0.5 rounded-lg border border-border text-[11px] font-semibold">
            <button
              onClick={() => setScanMode("AUTO")}
              className={`py-1.5 px-2 rounded-md transition-all text-center ${
                scanMode === "AUTO"
                  ? "bg-accent text-bg font-bold shadow-sm"
                  : "text-ash hover:text-whitesmoke"
              }`}
            >
              Auto (In & Out)
            </button>
            <button
              onClick={() => setScanMode("ENTRY_ONLY")}
              className={`py-1.5 px-2 rounded-md transition-all text-center ${
                scanMode === "ENTRY_ONLY"
                  ? "bg-accent text-bg font-bold shadow-sm"
                  : "text-ash hover:text-whitesmoke"
              }`}
            >
              Check In
            </button>
            <button
              onClick={() => setScanMode("EXIT_ONLY")}
              className={`py-1.5 px-2 rounded-md transition-all text-center ${
                scanMode === "EXIT_ONLY"
                  ? "bg-accent text-bg font-bold shadow-sm"
                  : "text-ash hover:text-whitesmoke"
              }`}
            >
              Check Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 p-3.5 max-w-4xl mx-auto w-full flex flex-col gap-3">
        {/* Mobile Navigation Tabs */}
        <div className="flex bg-surface border border-border p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "camera"
                ? "bg-surface-raised text-accent font-bold border border-border shadow-sm"
                : "text-ash hover:text-whitesmoke"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "manual"
                ? "bg-surface-raised text-accent font-bold border border-border shadow-sm"
                : "text-ash hover:text-whitesmoke"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Manual Roll</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "history"
                ? "bg-surface-raised text-accent font-bold border border-border shadow-sm"
                : "text-ash hover:text-whitesmoke"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Shift Log ({history.length})</span>
          </button>
        </div>

        {/* 1. CAMERA SCANNER VIEW */}
        {activeTab === "camera" && (
          <div className="space-y-3">
            {/* Live Camera Viewfinder Box */}
            <div
              className={`relative aspect-[4/3] sm:aspect-video w-full bg-black rounded-2xl border-2 overflow-hidden shadow-2xl flex flex-col items-center justify-center transition-all ${
                reticleFlash === "green"
                  ? "border-green-500 shadow-green-500/20"
                  : reticleFlash === "red"
                  ? "border-red-500 shadow-red-500/20"
                  : reticleFlash === "amber"
                  ? "border-amber-500 shadow-amber-500/20"
                  : "border-border"
              }`}
            >
              {/* Actual HTML5 Video Stream */}
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraStatus === "active" ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Status overlay if Camera is loading or failed */}
              {cameraStatus !== "active" && (
                <div className="absolute inset-0 bg-surface/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                  {cameraStatus === "requesting" ? (
                    <>
                      <Loader2 className="w-10 h-10 text-accent animate-spin" />
                      <p className="text-sm font-semibold text-whitesmoke">Connecting to Device Camera...</p>
                      <p className="text-xs text-ash">Please accept the browser camera prompt if requested</p>
                    </>
                  ) : cameraStatus === "error" ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                        <CameraOff className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-red-400">Camera Access Blocked</p>
                      <p className="text-xs text-ash max-w-xs">{cameraError}</p>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => startCamera(cameraFacing)}
                          className="px-4 py-2 rounded-xl bg-accent text-bg font-bold text-xs hover:bg-accent-hover transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Camera</span>
                        </button>
                        <button
                          onClick={() => setActiveTab("manual")}
                          className="px-4 py-2 rounded-xl bg-surface-raised border border-border text-whitesmoke font-bold text-xs hover:bg-border transition-colors"
                        >
                          Use Manual Entry
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-ash" />
                      <p className="text-sm font-semibold text-whitesmoke">Camera is currently stopped</p>
                      <button
                        onClick={() => startCamera(cameraFacing)}
                        className="px-4 py-2 rounded-xl bg-accent text-bg font-bold text-xs hover:bg-accent-hover transition-colors"
                      >
                        Start Camera
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Overlaid Scanning Reticle (Only when camera active) */}
              {cameraStatus === "active" && (
                <>
                  {/* Subtle Dark Vignette */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/50" />

                  {/* Targeting Box */}
                  <div className="absolute inset-10 sm:inset-16 pointer-events-none flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-lg" />
                      <div className="w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-lg" />
                    </div>

                    {/* Sweeping Laser Animation */}
                    {!isPaused && (
                      <div className="h-0.5 bg-accent shadow-[0_0_15px_#F28C28] animate-bounce w-full" />
                    )}

                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-lg" />
                      <div className="w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-lg" />
                    </div>
                  </div>

                  {/* Top Floating Controls on Camera */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-auto">
                    <div className="bg-bg/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-border text-[10px] font-mono text-whitesmoke flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span>{cameraFacing === "environment" ? "Back Camera" : "Front Camera"}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasTorch && (
                        <button
                          onClick={toggleTorch}
                          className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                            isTorchOn
                              ? "bg-accent text-bg border-accent shadow-md shadow-accent/30"
                              : "bg-bg/80 text-whitesmoke border-border hover:bg-bg"
                          }`}
                          title="Flashlight"
                        >
                          {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}

                      <button
                        onClick={toggleCameraFacing}
                        className="p-2 rounded-full bg-bg/80 backdrop-blur-md border border-border text-whitesmoke hover:bg-bg transition-all active:scale-95"
                        title="Flip Camera (Front/Back)"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>

                      <button
                        onClick={togglePause}
                        className={`p-2 rounded-full backdrop-blur-md border transition-all ${
                          isPaused
                            ? "bg-amber-500 text-bg border-amber-500 font-bold"
                            : "bg-bg/80 text-whitesmoke border-border hover:bg-bg"
                        }`}
                        title={isPaused ? "Resume Scanner" : "Pause Scanner"}
                      >
                        {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Processing Pill Indicator */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
                      <div className="bg-surface border border-border px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-whitesmoke shadow-2xl">
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                        <span>Verifying Student Pass...</span>
                      </div>
                    </div>
                  )}

                  {/* Target Guide Text */}
                  <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                    <span className="bg-bg/80 backdrop-blur-md px-3 py-1 rounded-full border border-border text-[10px] text-ash font-medium shadow-sm">
                      Align the student QR pass inside the target box
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Test Barcode Pills on Camera Screen */}
            <div className="bg-surface border border-border rounded-xl p-3">
              <span className="text-[10px] text-ash uppercase font-bold tracking-wider block mb-2">
                Quick Test Tap (No 2nd Phone Needed)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "22CS1001" })}
                  disabled={isScanning}
                  className="p-2 rounded-lg bg-surface-raised border border-border hover:border-accent text-left transition-all active:scale-95"
                >
                  <span className="text-[11px] font-bold text-whitesmoke block truncate">Aarav S.</span>
                  <span className="text-[10px] font-mono text-sand">22CS1001</span>
                </button>
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "22CS1002" })}
                  disabled={isScanning}
                  className="p-2 rounded-lg bg-surface-raised border border-border hover:border-accent text-left transition-all active:scale-95"
                >
                  <span className="text-[11px] font-bold text-whitesmoke block truncate">Aditi Rao</span>
                  <span className="text-[10px] font-mono text-sand">22CS1002</span>
                </button>
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "23CS1021" })}
                  disabled={isScanning}
                  className="p-2 rounded-lg bg-surface-raised border border-border hover:border-accent text-left transition-all active:scale-95"
                >
                  <span className="text-[11px] font-bold text-whitesmoke block truncate">Gaurav J.</span>
                  <span className="text-[10px] font-mono text-sand">23CS1021</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. MANUAL ENTRY VIEW */}
        {activeTab === "manual" && (
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-whitesmoke flex items-center gap-2">
                <Search className="w-4 h-4 text-accent" />
                <span>Manual Roll Number Validation</span>
              </h2>
              <p className="text-xs text-ash mt-0.5">
                Type the student roll number directly if phone screen is unreadable or camera is unavailable.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-ash uppercase tracking-wider block mb-1">
                  Student Roll Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={rollInput}
                    onChange={(e) => setRollInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 22CS1001"
                    className="w-full bg-bg border-2 border-border focus:border-accent rounded-xl px-4 py-3 text-base text-whitesmoke font-mono tracking-wider focus:outline-none"
                    autoFocus
                  />
                  {rollInput && (
                    <button
                      type="button"
                      onClick={() => setRollInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ash hover:text-whitesmoke"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isScanning || !rollInput.trim()}
                className="w-full py-3.5 rounded-xl bg-accent text-bg font-bold text-sm hover:bg-accent-hover disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 active:scale-98"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Scan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Verify & Update Movement</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-3 border-t border-border">
              <span className="text-[10px] text-ash uppercase font-bold tracking-wider block mb-2">
                Preset Test Profiles
              </span>
              <div className="flex flex-wrap gap-2">
                {["22CS1001", "22CS1002", "22CS1003", "23CS1021", "24CS1041"].map((roll) => (
                  <button
                    key={roll}
                    type="button"
                    onClick={() => {
                      setRollInput(roll);
                      handleScanSubmit({ rollNumber: roll });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border hover:border-accent text-xs font-mono text-sand transition-all"
                  >
                    {roll}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. SHIFT LOG & COUNTERS VIEW */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {/* Shift Counters */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface border border-border p-3 rounded-xl text-center">
                <span className="text-[10px] text-ash uppercase font-semibold">Entries</span>
                <div className="text-xl font-bold text-accent font-mono mt-0.5">{counters.entries}</div>
              </div>
              <div className="bg-surface border border-border p-3 rounded-xl text-center">
                <span className="text-[10px] text-ash uppercase font-semibold">Exits</span>
                <div className="text-xl font-bold text-sand font-mono mt-0.5">{counters.exits}</div>
              </div>
              <div className="bg-surface border border-border p-3 rounded-xl text-center">
                <span className="text-[10px] text-ash uppercase font-semibold">Rejections</span>
                <div className="text-xl font-bold text-red-400 font-mono mt-0.5">{counters.rejections}</div>
              </div>
            </div>

            {/* Shift Log List */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-whitesmoke flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sand" />
                  <span>Recent Scans This Shift</span>
                </h3>
                <span className="text-[11px] font-mono text-ash">{history.length} records</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
                {history.length > 0 ? (
                  history.map((h, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-bg border border-border flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-whitesmoke">
                          {h.student?.fullName || "Unregistered ID"}
                        </div>
                        <div className="text-[10px] text-ash font-mono mt-0.5">
                          {h.student?.rollNumber || "N/A"} • {h.eventType || h.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            h.status === "ACCEPTED"
                              ? "bg-green-500/15 text-green-400 border border-green-500/30"
                              : h.status === "DUPLICATE"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {h.status}
                        </span>
                        <div className="text-[10px] text-ash font-mono mt-0.5">{h.timestamp}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-ash text-xs py-8">No scan records logged during this session yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Scan Result Card (Always visible right under action area) */}
        {lastResult && (
          <div
            className={`p-4 rounded-2xl border shadow-xl relative animate-in fade-in slide-in-from-top-2 duration-200 ${
              lastResult.status === "ACCEPTED"
                ? "bg-green-500/10 border-green-500/40 text-whitesmoke"
                : lastResult.status === "DUPLICATE"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                : "bg-red-500/10 border-red-500/40 text-red-200"
            }`}
          >
            <button
              onClick={() => setLastResult(null)}
              className="absolute top-3 right-3 p-1 rounded-md text-ash hover:text-whitesmoke"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
              {lastResult.status === "ACCEPTED" ? (
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
              ) : lastResult.status === "DUPLICATE" ? (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
              )}

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between pr-6">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {lastResult.status === "ACCEPTED"
                      ? lastResult.eventType === "LIBRARY_ENTRY"
                        ? "✓ Entry Verified (Checked In)"
                        : "✓ Exit Verified (Checked Out)"
                      : lastResult.status === "DUPLICATE"
                      ? "⚠ Already Scanned (Wait 10s)"
                      : "✕ Pass Rejected"}
                  </span>
                  <span className="text-[10px] font-mono text-ash">{lastResult.timestamp}</span>
                </div>

                <p className="text-sm font-semibold">{lastResult.message}</p>

                {lastResult.student && (
                  <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-ash uppercase block">Student</span>
                      <span className="font-bold text-whitesmoke text-sm">{lastResult.student.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ash uppercase block">Roll Number</span>
                      <span className="font-mono text-sand font-bold text-sm">
                        {lastResult.student.rollNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ash uppercase block">Cohort / Dept</span>
                      <span className="truncate block text-whitesmoke">
                        {lastResult.student.category}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ash uppercase block">Current Location</span>
                      <span
                        className={`font-semibold inline-block px-2 py-0.5 rounded-md text-[11px] ${
                          lastResult.targetInLibrary === 1
                            ? "bg-accent/20 text-accent font-bold"
                            : "bg-surface-raised text-ash"
                        }`}
                      >
                        {lastResult.targetInLibrary === 1 ? "Inside Library" : "Outside Library"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="bg-surface border-t border-border px-4 py-2 text-center text-[10px] text-ash flex items-center justify-between">
        <span className="truncate">Checkpoint: {CHECKPOINTS.find((c) => c.id === selectedCheckpoint)?.name}</span>
        <span className="text-sand font-mono shrink-0 ml-2">Live Cloud Sync: Connected</span>
      </footer>
    </div>
  );
}