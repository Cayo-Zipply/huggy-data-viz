import { cleanupLocalStorage } from "@/lib/clearLocalData";
cleanupLocalStorage();
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
