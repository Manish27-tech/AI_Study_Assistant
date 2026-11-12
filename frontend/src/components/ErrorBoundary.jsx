import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ color: "#ef4444", marginBottom: "16px" }}>Oops, something went wrong.</h1>
          <p style={{ color: "#6b7280", marginBottom: "24px" }}>
            The application encountered an unexpected error.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}