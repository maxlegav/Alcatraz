import { Navbar } from '@/app/_components/landing/Navbar';
import { HeroSection } from '@/app/_components/landing/HeroSection';
import { HowItWorksSection } from '@/app/_components/landing/HowItWorksSection';
import { PlugAndPlaySection } from '@/app/_components/landing/PlugAndPlaySection';
import { CTASection } from '@/app/_components/landing/CTASection';
import { Footer } from '@/app/_components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 pt-8 sm:px-8 lg:px-10">
        <Navbar />
      </div>
      <HeroSection />
      <HowItWorksSection />
      <PlugAndPlaySection />
      <CTASection />
      <Footer />
    </div>
  );
}
