import React from 'react';
import { Navbar } from './Navbar';
import { ChatPanel } from '../chat/ChatPanel';
import { useAuthStore } from '../../store/authStore';

export const PageLayout = ({ children }) => {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      <ChatPanel />
    </div>
  );
};

export default PageLayout;
