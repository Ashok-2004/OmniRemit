import React from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div id="lead-mf-scope">
        <MainLayout />
      </div>
    </ErrorBoundary>
  );
};

export default App;
