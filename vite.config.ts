import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      // Force any legacy import of the generated client to resolve to the
      // canonical external CRM client instead of the managed project client.
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/lib/supabaseExternal.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
}));
