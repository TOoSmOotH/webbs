import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Boards from './pages/Boards';
import Files from './pages/Files';
import AnsiArt from './pages/AnsiArt';
import MenuBuilder from './pages/MenuBuilder';

// Create a modern theme for the admin panel
const adminTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default function AdminRouter() {
  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="boards" element={<Boards />} />
            <Route path="files" element={<Files />} />
            <Route path="ansi-art" element={<AnsiArt />} />
            <Route path="menu-builder" element={<MenuBuilder />} />
            <Route path="statistics" element={<PlaceholderPage title="Statistics" />} />
            <Route path="security" element={<PlaceholderPage title="Security" />} />
            <Route path="settings" element={<PlaceholderPage title="Settings" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Temporary placeholder component for pages not yet implemented
function PlaceholderPage({ title }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This page is under construction.</p>
    </div>
  );
}