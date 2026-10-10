import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// If something unexpected breaks, show a message instead of a blank page.
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("TaskZen crashed:", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="splash">
        <h2>Something went wrong</h2>
        <p>Your data is safe. Reload the page to continue.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
