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
      // Force the auto-generated Supabase client to resolve to the external
      // (riyfdcmmabvpcubusujw) client. This eliminates the ghost
      // xcjpoycwezdagbjrkhmq client from the bundle entirely.
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/lib/supabaseExternal.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
}));
