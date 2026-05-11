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
    alias: {
      // Redirect the auto-generated Supabase client (which points at the
      // ghost xcjpoycwezdagbjrkhmq project) to the canonical "cayo" client.
      // Guarantees a single GoTrueClient instance and avoids the
      // "Unsupported provider: missing OAuth secret" error on Google login.
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/lib/supabaseExternal.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
