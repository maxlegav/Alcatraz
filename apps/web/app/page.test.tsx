import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootPage from './page';
import DashboardPage from './dashboard/page';

describe('app routes', () => {
  it('renders the enterprise landing page at the root route', () => {
    const html = renderToStaticMarkup(<RootPage />);

    expect(html).toContain('Products');
    expect(html).toContain('Go to dashboard');
    expect(html).toContain('Trusted by');
    expect(html).toContain('Enterprise Ready.');
    expect(html).toContain(
      'Alcatraz pentests every release, generates guardrails, and stops dangerous tool calls before they touch real data.',
    );
    expect(html).toContain('See it in action');
    expect(html).toContain('A red team fully scans and pentests the agent.');
    expect(html).toContain('Guardrails are created with an agent-readable summary.');
    expect(html).toContain('A live log tail shows allowed, blocked, and human-reviewed calls.');
    expect(html).toContain('Plug and play into any Python agent');
    expect(html).toContain('Install the SDK, wrap your agent, and Alcatraz starts evaluating tool calls immediately.');
    expect(html).toContain('read .env');
    expect(html).toContain('href="/dashboard"');
  });

  it('keeps the dashboard client mounted at /dashboard', () => {
    const element = DashboardPage();

    expect(element).toBeTruthy();
    expect(typeof element).toBe('object');
  });
});
