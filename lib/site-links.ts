/** Public release destinations shared by the landing page actions. */
export const SITE_LINKS = {
  android: { label: 'Download Android', url: 'https://github.com/LeePads/TinySurprise/releases/latest' },
  github: { label: 'GitHub', url: 'https://github.com/LeePads/TinySurprise' },
  projects: [
    { label: 'Caizen', url: 'https://www.caizen.space/' },
    { label: 'CaiTCMS', url: 'https://caitcms.vercel.app/auth/login?next=%2Fdashboard' },
    { label: 'Likhalin', url: 'https://likhalin.vercel.app/' },
  ] as { label: string; url: string | null }[],
};
