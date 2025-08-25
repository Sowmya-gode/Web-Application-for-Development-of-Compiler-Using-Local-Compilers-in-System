import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Suppress benign ResizeObserver errors in CRA overlay
const ignoreResizeObserverError = (event) => {
  const message = event?.message || "";
  if (
    typeof message === "string" &&
    (message.includes("ResizeObserver loop limit exceeded") ||
      message.includes("ResizeObserver loop completed with undelivered notifications"))
  ) {
    event.stopImmediatePropagation();
  }
};

window.addEventListener("error", ignoreResizeObserverError, true);
window.addEventListener("unhandledrejection", ignoreResizeObserverError, true);

// Render app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
