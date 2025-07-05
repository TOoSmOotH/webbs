import React from 'react';
import './Header.css';

const Header = ({ connectionStatus }) => {
  const currentTime = new Date().toLocaleString();

  return (
    <header className="header">
      <div className="header-left">
        <span className="system-name">WEBBS</span>
        <span className="version">v1.0</span>
      </div>
      <div className="header-center">
        <span className="connection-status">
          Status: <span className={`status-${connectionStatus.toLowerCase()}`}>
            {connectionStatus}
          </span>
        </span>
      </div>
      <div className="header-right">
        <span className="current-time">{currentTime}</span>
      </div>
    </header>
  );
};

export default Header;