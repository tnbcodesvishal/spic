import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { BeamsBackground } from "@/components/ui/beams-background";
import "@/lib/firebase"; // Initialize Firebase on app load
import Index from "./pages/Index";
import About from "./pages/About";
import Events from "./pages/Events";
import Team from "./pages/Team";
import JoinTeam from "./pages/JoinTeam";
import Scanner from "./pages/Scanner";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Gallery from "./pages/Gallery";
import Register from "./pages/Register";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BeamsBackground intensity="subtle" />
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/events" element={<Events />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/team" element={<Team />} />
              <Route path="/join" element={<JoinTeam />} />
              <Route path="/scan" element={<Scanner />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/register/:eventId" element={<Register />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Footer />
          <ScrollToTop />
        </div>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
