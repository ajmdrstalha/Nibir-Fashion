import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
	setBaseUrl(apiBaseUrl);
} else if (window.location.protocol === "file:") {
	setBaseUrl("http://127.0.0.1:12501");
}

createRoot(document.getElementById("root")!).render(<App />);
