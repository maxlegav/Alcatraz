import React from 'react';
import HeroSection from './HeroSection';
import ProblemSection from './ProblemSection';
import HowItWorksSection from './HowItWorksSection';
import PlugAndPlaySection from './PlugAndPlaySection';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-on-surface-variant)]">
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <PlugAndPlaySection />
    </main>
  );
}
