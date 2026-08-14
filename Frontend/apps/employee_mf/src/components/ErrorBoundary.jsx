import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
          }}
        >
          <h2>Employee module failed to load</h2>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
