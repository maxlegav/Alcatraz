import React from 'react';
import { Navbar } from './_components/landing/Navbar';
import { HeroSection } from './_components/landing/HeroSection';
import { HowItWorksSection } from './_components/landing/HowItWorksSection';
import { PlugAndPlaySection } from './_components/landing/PlugAndPlaySection';
import { CTASection } from './_components/landing/CTASection';
import { Footer } from './_components/landing/Footer';

export default function Page() {
  return (
    <main className="min-h-screen bg-[#fcfcfd] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pt-6 sm:px-8 lg:px-10">
        <Navbar />
      </div>
      <HeroSection />
      <HowItWorksSection />
      <PlugAndPlaySection />
      <CTASection />
      <Footer />
    </main>
  );
}
