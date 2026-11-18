import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // ห้าม reset ทับหน้าตาของ styles/prototype.css
  theme: { extend: {} },
  plugins: [],
};

export default config;
