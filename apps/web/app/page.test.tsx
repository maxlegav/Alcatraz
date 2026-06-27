import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootPage from './page';
import DashboardPage from './dashboard/page';

describe('app routes', () => {
  it('renders a placeholder landing page at the root route', () => {
    const html = renderToStaticMarkup(<RootPage />);

    expect(html).toContain('Landing page coming soon');
    expect(html).toContain('href="/dashboard"');
  });

  it('keeps the dashboard client mounted at /dashboard', () => {
    const element = DashboardPage();

    expect(element).toBeTruthy();
    expect(typeof element).toBe('object');
  });
});
