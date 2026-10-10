/** Enable these destinations only after the owner confirms public availability. */
export const SITE_LINKS = {
  android: { label: 'Download Android App', url: null as string | null },
  // Future public destination: https://github.com/LeePads/TinySurprise
  github: { label: 'GitHub', url: null as string | null },
  projects: [
    { label: 'Caizen', url: 'https://www.caizen.space/' },
    { label: 'CaiTCMS', url: 'https://caitcms.vercel.app/auth/login?next=%2Fdashboard' },
    { label: 'Likhalin', url: 'https://likhalin.vercel.app/' },
  ] as { label: string; url: string | null }[],
};
