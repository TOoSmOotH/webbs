import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App'; // The existing BBS terminal app
import AdminRouter from './admin/AdminRouter';

function MainApp() {
  return (
    <Router>
      <Routes>
        {/* Admin routes */}
        <Route path="/admin/*" element={<AdminRouter />} />
        
        {/* BBS Terminal (default) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </Router>
  );
}

export default MainApp;