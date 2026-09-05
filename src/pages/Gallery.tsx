import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, Layers, Eye, ArrowLeft, Maximize2 } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import SmartImage from "@/components/SmartImage";
import { subscribeToGallery, type GalleryAlbum } from "@/services/firebaseGallery";

function GalleryAlbumCard({
  album,
  onSelectPhoto,
}: {
  album: GalleryAlbum;
  onSelectPhoto: (album: GalleryAlbum, photoIndex: number) => void;
}) {
  const images = album.images && album.images.length > 0 ? album.images : [album.coverImage || ""];
  if (!images[0]) return null;

  return (
    <Card
      className="group overflow-hidden cursor-pointer border border-border/70 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col will-change-transform bg-card/80"
      onClick={() => onSelectPhoto(album, 0)}
    >
      <div className="relative overflow-hidden aspect-[4/3]">
        <SmartImage
          src={images[0]}
          alt={album.title}
          className="group-hover:scale-105 transition-transform duration-700 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[2px] p-4 text-center">
          <Maximize2 className="text-white h-8 w-8 shadow-sm" />
          <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1 rounded-full border border-white/20">
            Open Fullscreen Lightbox
          </span>
        </div>
      </div>
      <CardContent className="p-5 flex-1 glass-card border-t-0 flex flex-col justify-between">
        <div>
          <h3 className="font-display font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
            {album.title}
          </h3>
          {album.category && (
            <span className="inline-block text-[11px] font-medium text-primary px-2.5 py-0.5 rounded-full bg-primary/10 mb-2">
              {album.category}
            </span>
          )}
          {album.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{album.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            {images.length} photo{images.length === 1 ? "" : "s"}
          </span>
          <span className="text-primary font-semibold flex items-center gap-1 hover:underline">
            View <Eye className="h-3.5 w-3.5 ml-0.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const Gallery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventFilter = searchParams.get("event");
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Lightbox state
  const [lightboxAlbum, setLightboxAlbum] = useState<GalleryAlbum | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Expanded Album View
  const [expandedAlbum, setExpandedAlbum] = useState<GalleryAlbum | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToGallery((list) => {
      setAlbums(list);
    });
    return () => unsubscribe();
  }, []);

  // Filter categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    albums.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ["all", ...Array.from(set)];
  }, [albums]);

  const displayedAlbums = useMemo(() => {
    return albums.filter((a) => {
      const matchesEvent =
        !eventFilter ||
        a.id.toLowerCase().includes(eventFilter.toLowerCase()) ||
        (a.category && a.category.toLowerCase().includes(eventFilter.toLowerCase()));
      const matchesCat = selectedCategory === "all" || a.category === selectedCategory;
      return matchesEvent && matchesCat;
    });
  }, [albums, eventFilter, selectedCategory]);

  const handleOpenPhoto = (album: GalleryAlbum, photoIndex: number) => {
    setLightboxAlbum(album);
    setLightboxIndex(photoIndex);
    setLightboxOpen(true);
  };

  return (
    <main className="min-h-screen pb-24">
      {/* Hero Header */}
      <section className="section-padding text-center px-4 bg-gradient-to-b from-background via-background/95 to-background">
        <AnimatedSection className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" /> Official Event Showcase
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
            Event <span className="text-gradient">Gallery</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Reliving moments from our competitions, hackathons, and workshops. Click any album or image to open in full screen.
          </p>
        </AnimatedSection>
      </section>

      {/* Category Pills & Controls */}
      {!expandedAlbum && (
        <div className="container mx-auto px-4 mb-8">
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                className="text-xs capitalize h-9 px-4 rounded-full font-medium"
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Expanded Album View (Grid of all photos in an album) ────────── */}
      {expandedAlbum ? (
        <section className="container mx-auto px-4 py-4">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedAlbum(null)}
                className="text-xs mb-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to All Albums
              </Button>
              <h2 className="font-display text-2xl font-bold">{expandedAlbum.title}</h2>
              {expandedAlbum.description && (
                <p className="text-xs text-muted-foreground mt-1">{expandedAlbum.description}</p>
              )}
            </div>
            <span className="text-xs font-semibold text-primary px-3 py-1 rounded-full bg-primary/10">
              {expandedAlbum.images.length} Photos
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {expandedAlbum.images.map((imgUrl, idx) => (
              <div
                key={idx}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-border/60 shadow-sm hover:shadow-xl transition-all duration-300"
                onClick={() => handleOpenPhoto(expandedAlbum, idx)}
              >
                <img
                  src={imgUrl}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="text-white w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ─── Albums Grid View ────────────────────────────────────────────── */
        <section className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedAlbums.map((album, i) => (
              <AnimatedSection key={album.id} delay={i * 0.04}>
                <GalleryAlbumCard album={album} onSelectPhoto={handleOpenPhoto} />
              </AnimatedSection>
            ))}

            {displayedAlbums.length === 0 && (
              <div className="col-span-full py-20 text-center border border-dashed rounded-2xl">
                <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">No gallery photos found.</p>
                {(eventFilter || selectedCategory !== "all") && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory("all");
                      setSearchParams({});
                    }}
                  >
                    View All Gallery Albums
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Full-Screen Image Lightbox ───────────────────────────────────── */}
      {lightboxAlbum && (
        <ImageLightbox
          images={lightboxAlbum.images && lightboxAlbum.images.length > 0 ? lightboxAlbum.images : [lightboxAlbum.coverImage || ""]}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          title={lightboxAlbum.title}
        />
      )}
    </main>
  );
};

export default Gallery;
