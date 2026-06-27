import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootPage from './page';
import DashboardPage from './dashboard/page';

describe('app routes', () => {
  it('renders the v1 landing page at the root route', () => {
    const html = renderToStaticMarkup(<RootPage />);

    expect(html).toContain('Secure AI agents before they touch your systems');
    expect(html).toContain('See the problem');
    expect(html).toContain('How it works');
    expect(html).toContain('Plug in with a few lines');
    expect(html).toContain('alcatraz.init()');
    expect(html).toContain('href="/dashboard"');
  });

  it('keeps the dashboard client mounted at /dashboard', () => {
    const element = DashboardPage();

    expect(element).toBeTruthy();
    expect(typeof element).toBe('object');
  });
});
