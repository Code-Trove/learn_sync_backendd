import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../styles/tailwind.css";

console.log("Content script loaded!"); // Debug log

// Check if the container already exists
const existingContainer = document.getElementById("learn-share-root");

if (!existingContainer) {
  // Create and inject a new container for the React app
  const container = document.createElement("div");
  container.id = "learn-share-root";
  document.body.appendChild(container);

  // Mount the React app
  const root = createRoot(container);
  root.render(<App />);
  console.log("React app mounted!");
} else {
  console.log("React container already exists.");
}
