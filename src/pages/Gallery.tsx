import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import SmartImage from "@/components/SmartImage";
import { subscribeToGallery, type GalleryAlbum } from "@/services/firebaseGallery";

function GalleryAlbumCard({ album }: { album: GalleryAlbum }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = album.images && album.images.length > 0 ? album.images : [album.coverImage || ""];

  const handleOpenChange = (open: boolean) => {
    setLightboxOpen(open);
    if (!open) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("event");
      setSearchParams(newParams);
    }
  };

  if (!images[0]) return null;

  return (
    <>
      <Card
        className="group overflow-hidden cursor-pointer border border-border/70 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col will-change-transform"
        onClick={() => setLightboxOpen(true)}
      >
        <div className="relative overflow-hidden aspect-[4/3]">
          <SmartImage
            src={images[0]}
            alt={album.title}
            className="group-hover:scale-105 transition-transform duration-700 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <ImageIcon className="text-white h-10 w-10 shadow-sm" />
          </div>
        </div>
        <CardContent className="p-5 flex-1 glass-card border-t-0 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg mb-1">{album.title}</h3>
            {album.category && (
              <span className="inline-block text-[11px] font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10 mb-2">
                {album.category}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 pt-2">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            {images.length} photo{images.length === 1 ? "" : "s"}
          </p>
        </CardContent>
      </Card>

      <ImageLightbox
        images={images}
        open={lightboxOpen}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}

const Gallery = () => {
  const [searchParams] = useSearchParams();
  const eventFilter = searchParams.get("event");
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToGallery((list) => {
      setAlbums(list);
    });
    return () => unsubscribe();
  }, []);

  const displayedAlbums = eventFilter
    ? albums.filter((a) => a.id.toLowerCase().includes(eventFilter.toLowerCase()) || (a.category && a.category.toLowerCase().includes(eventFilter.toLowerCase())))
    : albums;

  return (
    <main>
      <section className="section-padding text-center px-4">
        <AnimatedSection className="max-w-2xl mx-auto">
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Event <span className="text-gradient">Gallery</span>
          </h1>
          <p className="text-base text-muted-foreground">Reliving the best moments from our past events, hackathons, and workshops.</p>
        </AnimatedSection>
      </section>

      <section className="section-padding-sm pt-0 border-t-0">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedAlbums.map((album, i) => (
              <AnimatedSection key={album.id} delay={i * 0.05}>
                <GalleryAlbumCard album={album} />
              </AnimatedSection>
            ))}
            {displayedAlbums.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground">No gallery photos found.</p>
                {eventFilter && (
                  <Button variant="link" onClick={() => (window.location.href = "/gallery")}>
                    View All Gallery
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Gallery;
