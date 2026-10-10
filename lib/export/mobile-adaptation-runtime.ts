/**
 * Small, recipient-facing mobile rules shared by every standalone export.
 * Kept separate from the theme strings so safe-area and size-class changes
 * stay reviewable without changing embedded media or runtime behavior.
 */
export const mobileAdaptationCss = String.raw`
button{min-height:48px}
.dialog{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
@media(max-width:599px){
  .dialog{max-height:calc(100dvh - env(safe-area-inset-top) - 8px);padding-bottom:calc(18px + env(safe-area-inset-bottom))}
}
@media(max-height:560px) and (orientation:landscape){
  .catch-experience{padding:8px}
  .catch-header{padding:6px 4px}
  .catch-header h1{font-size:1.6rem}
  .catch-field{min-height:min(17rem,62svh)}
  .catch-footer{padding:8px}
  .dialog.heart-dialog{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1rem)}
  #puzzle-final:not(.hidden){padding:12px}
}
:root{--scrollbar-thumb:color-mix(in srgb,var(--brand) 35%,var(--border));--scrollbar-thumb-hover:color-mix(in srgb,var(--brand) 58%,var(--border));--scrollbar-track:var(--surface)}
html,*{scrollbar-width:thin;scrollbar-color:var(--scrollbar-thumb) var(--scrollbar-track)}html{scrollbar-gutter:stable}::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:var(--scrollbar-track)}::-webkit-scrollbar-thumb{border:2px solid var(--scrollbar-track);border-radius:999px;background:var(--scrollbar-thumb);background-clip:padding-box}::-webkit-scrollbar-thumb:hover{background:var(--scrollbar-thumb-hover);background-clip:padding-box}
@supports selector(::-webkit-scrollbar){html,*{scrollbar-width:auto;scrollbar-color:auto}}
@media(pointer:coarse){html,*{scrollbar-width:auto;scrollbar-color:auto}html{scrollbar-gutter:auto}::-webkit-scrollbar{width:revert;height:revert}::-webkit-scrollbar-track,::-webkit-scrollbar-thumb{background:revert;border:revert}}
@media(forced-colors:active){html,*{scrollbar-width:auto;scrollbar-color:auto}::-webkit-scrollbar-track{background:Canvas}::-webkit-scrollbar-thumb{background:CanvasText;border-color:Canvas}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
