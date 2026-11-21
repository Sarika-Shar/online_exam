import React, { useState } from 'react';
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

  return (
    <div className="d-flex position-relative">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
          style={{ zIndex: 1025 }}
          onClick={closeSidebar}
        ></div>
      )}

      {/* Navigation Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main Wrapper */}
      <div className="main-wrapper flex-grow-1">
        <Navbar onToggleSidebar={toggleSidebar} />
        <main className="flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
