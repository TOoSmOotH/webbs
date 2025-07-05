import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal';
import Header from './components/Header';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  useEffect(() => {
    // Simulate connection establishment
    const timer = setTimeout(() => {
      setIsConnected(true);
      setConnectionStatus('Connected');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="App">
      <Header connectionStatus={connectionStatus} />
      <main className="app-content">
        {isConnected ? (
          <Terminal />
        ) : (
          <div className="connection-screen">
            <div className="connection-message">
              <div className="ascii-art">
                {`
╔══════════════════════════════════════════════════════════════════════════════╗
║                              WEBBS v1.0                                     ║
║                        Web-Based Bulletin Board System                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
                `}
              </div>
              <div className="status-message">
                {connectionStatus}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;