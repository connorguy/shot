import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "@fontsource-variable/inter";
import "./styles.css";
import "./lib/headless.ts";

createRoot(document.getElementById("root")!).render(<App />);
