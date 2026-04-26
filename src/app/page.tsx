import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Education from "@/components/sections/Education";
import News from "@/components/sections/News";
import Teachers from "@/components/sections/Teachers";
import Students from "@/components/sections/Students";
import Parents from "@/components/sections/Parents";
import Contacts from "@/components/sections/Contacts";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Education />
        <News />
        <Teachers />
        <Students />
        <Parents />
        <Contacts />
      </main>
      <Footer />
    </>
  );
}
