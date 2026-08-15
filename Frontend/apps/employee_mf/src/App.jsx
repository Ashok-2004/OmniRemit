import Dashboard from "./pages/Dashboard";

import ErrorBoundary from "./components/ErrorBoundary";

import "./index.css";
import "./styles/dashboard.css";
import "./styles/table.css";
import "./styles/modal.css";

function App() {
  return (
    <ErrorBoundary>
      {/*
        This id is this remote's CSS isolation boundary — postcss.config.cjs rewrites every selector
        in this app's stylesheets to sit under it, so none of them can leak into the host or another
        remote. It must stay in sync with SCOPE_ID in that config.

        The `employee-mf-root` class that used to sit alongside it was removed: the prefixer turns
        `.employee-mf-root` into a DESCENDANT selector, so rules written against it never matched
        this element. Those styles now live under `:root` in index.css, which the prefixer maps onto
        this element directly.
      */}
      <div id="employee-mf-scope">
        <Dashboard />
      </div>
    </ErrorBoundary>
  );
}

export default App;
