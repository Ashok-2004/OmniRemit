import Dashboard from "./pages/Dashboard";

import ErrorBoundary from "./components/ErrorBoundary";

import "./index.css";
import "./styles/dashboard.css";
import "./styles/table.css";
import "./styles/modal.css";

import { NxButton } from '@myorg/shared';

function App() {
return ( <ErrorBoundary> <div id="employee-mf-scope" className="employee-mf-root"> <NxButton label="Employee Nx Button" /> <Dashboard /> </div> </ErrorBoundary>
);
}

export default App;
