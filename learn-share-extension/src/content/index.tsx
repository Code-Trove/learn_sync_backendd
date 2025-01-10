import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/tailwind.css";

console.log("Content script loaded!"); // Debug log

// Create container
const container = document.createElement("div");
container.id = "learn-share-root";
document.body.appendChild(container);

// Initialize React
const root = createRoot(container);
root.render(<App />);

// Debug log
console.log("React app mounted!");
