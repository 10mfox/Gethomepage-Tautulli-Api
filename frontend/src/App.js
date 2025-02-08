import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Dashboard from './components/Dashboard';
import FormatManager from './components/FormatManager';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Nav />
        <div className="container mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/format" element={<FormatManager />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;