import nextConfig from 'eslint-config-next/core-web-vitals'

const config = [
  // A flat-config object that mixes `ignores` with other keys (like
  // `rules`) only scopes those other keys — it is not a global ignore. The
  // generated Android/Gradle output (native-bridge.js etc.) needs a
  // standalone `ignores`-only entry to actually be skipped everywhere.
  {
    ignores: ['android/**', 'out/**'],
  },
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', '*.png', '*.jpg'],
    rules: {
      // These components intentionally initialize browser-only animation and
      // puzzle state after mount to avoid hydration mismatches.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default config
