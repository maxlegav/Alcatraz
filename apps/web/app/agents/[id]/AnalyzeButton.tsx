'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerAgentAnalysis } from './analyze-action';

export default function AnalyzeButton({
  agentId,
  label = 'Analyze',
}: {
  agentId: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    try {
      await triggerAgentAnalysis(agentId);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleAnalyze}
      disabled={loading}
      className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? 'Analyzing...' : label}
    </button>
  );
}
