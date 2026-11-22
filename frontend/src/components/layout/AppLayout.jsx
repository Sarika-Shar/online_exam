import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../common/Sidebar';
import Navbar from '../common/Navbar';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Prevent background scrolling when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="d-flex position-relative w-100" style={{ minWidth: 0, maxWidth: '100vw', overflowX: 'clip' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
          style={{ zIndex: 1040, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={closeSidebar}
        ></div>
      )}

      {/* Navigation Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Wrapper */}
      <div className="main-wrapper flex-grow-1" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'clip' }}>
        <Navbar onToggleSidebar={toggleSidebar} />
        <main className="flex-grow-1 w-100" style={{ minWidth: 0, maxWidth: '100%', overflowX: 'clip' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
