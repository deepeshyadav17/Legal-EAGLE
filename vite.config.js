import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Security: strictly whitelist only non-sensitive public environment variables
// so backend secrets (DATABASE_URL, JWT_ACCESS_SECRET, RAZORPAY_KEY_SECRET, etc.)
// are never exposed in the client bundle.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: ['VITE_PUBLIC_', 'VITE_API_BASE_URL', 'VITE_DEMO_MODE'],
  server: { port: 5173, open: false },
});
