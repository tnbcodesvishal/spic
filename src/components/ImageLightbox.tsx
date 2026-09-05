import { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Download,
  ZoomIn,
  ZoomOut,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export default function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
  title,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, open]);

  // Prefetch neighboring images for instant transitions
  useEffect(() => {
    if (!open || images.length <= 1) return;

    const prefetch = (index: number) => {
      const img = new Image();
      img.src = images[index];
    };

    const nextIndex = (currentIndex + 1) % images.length;
    const prevIndex = (currentIndex - 1 + images.length) % images.length;

    prefetch(nextIndex);
    prefetch(prevIndex);
  }, [currentIndex, open, images]);

  // Keyboard navigation & lock body scroll
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, currentIndex, images.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsZoomed(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsZoomed(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const handleDownload = async () => {
    const currentUrl = images[currentIndex];
    if (!currentUrl) return;
    try {
      const response = await fetch(currentUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `spic_gallery_${currentIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(currentUrl, "_blank");
    }
  };

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-between bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-300"
      onClick={() => onOpenChange(false)}
    >
      {/* ─── Top Control Bar ────────────────────────────────────────────── */}
      <div
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-50 gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-white overflow-hidden">
          <div className="p-2 rounded-lg bg-white/10 border border-white/10 hidden sm:flex">
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="truncate">
            {title && <h3 className="font-display text-sm sm:text-base font-semibold truncate text-white">{title}</h3>}
            <p className="text-xs text-white/70">
              Photo <span className="text-primary font-bold">{currentIndex + 1}</span> of {images.length}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 rounded-full h-9 w-9 sm:h-10 sm:w-10"
            onClick={() => setIsZoomed((prev) => !prev)}
            title={isZoomed ? "Fit to screen" : "Zoom in"}
          >
            {isZoomed ? <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" /> : <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>

          {/* Download */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 rounded-full h-9 w-9 sm:h-10 sm:w-10"
            onClick={handleDownload}
            title="Download image"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 rounded-full h-9 w-9 sm:h-10 sm:w-10 hidden sm:flex"
            onClick={toggleFullscreen}
            title="Toggle full screen"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-red-500/80 bg-white/10 rounded-full h-9 w-9 sm:h-10 sm:w-10 ml-1"
            onClick={() => onOpenChange(false)}
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ─── Main Image Viewer Container ────────────────────────────────── */}
      <div
        className="relative flex-1 w-full h-full flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Button Left */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-40 text-white bg-black/50 hover:bg-white/20 border border-white/10 rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-2xl transition-transform active:scale-95"
            onClick={handlePrev}
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="h-8 w-8 sm:h-10 sm:w-10" />
          </Button>
        )}

        {/* Display Image */}
        <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
          <img
            key={currentImage}
            src={currentImage}
            alt={`Gallery image ${currentIndex + 1}`}
            onClick={() => setIsZoomed((prev) => !prev)}
            className={`transition-all duration-300 select-none ${
              isZoomed
                ? "max-w-none max-h-none scale-125 cursor-zoom-out"
                : "max-w-full max-h-[82vh] object-contain cursor-zoom-in rounded-lg shadow-2xl"
            }`}
            loading="eager"
          />
        </div>

        {/* Navigation Button Right */}
        {images.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-40 text-white bg-black/50 hover:bg-white/20 border border-white/10 rounded-full h-12 w-12 sm:h-14 sm:w-14 shadow-2xl transition-transform active:scale-95"
            onClick={handleNext}
            title="Next (Right Arrow)"
          >
            <ChevronRight className="h-8 w-8 sm:h-10 sm:w-10" />
          </Button>
        )}
      </div>

      {/* ─── Bottom Thumbnail Strip ────────────────────────────────────── */}
      {images.length > 1 && (
        <div
          className="w-full px-4 py-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex justify-center z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2.5 max-w-[95vw] sm:max-w-[80vw] overflow-x-auto py-1 scrollbar-none no-scrollbar">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsZoomed(false);
                }}
                className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-lg overflow-hidden transition-all flex-shrink-0 border-2 ${
                  idx === currentIndex
                    ? "border-primary scale-105 ring-2 ring-primary/50 shadow-xl opacity-100 z-10"
                    : "border-transparent opacity-40 hover:opacity-100"
                }`}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
