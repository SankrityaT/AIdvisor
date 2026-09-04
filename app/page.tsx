import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Bento from "@/components/Bento";
import HowItWorks from "@/components/HowItWorks";
import Trust from "@/components/Trust";
import Stats from "@/components/Stats";
import Testimonials from "@/components/Testimonials";
import CtaBand from "@/components/CtaBand";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <div className="topbar">
        <b>Now in beta</b> for all Sun Devils
        <span className="dot-sep">·</span> Tempe
        <span className="dot-sep">·</span> West
        <span className="dot-sep">·</span> Poly
        <span className="dot-sep">·</span> Downtown
        <span className="dot-sep">·</span> Online
      </div>
      <Nav />
      <main id="top">
        <Hero />
        <Marquee />
        <Bento />
        <HowItWorks />
        <Trust />
        <Stats />
        <Testimonials />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
