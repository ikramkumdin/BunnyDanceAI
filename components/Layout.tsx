'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  backLabel?: string;
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onSearch?: (query: string) => void;
}

export default function Layout({ 
  children, 
  showBackButton = false, 
  backLabel = '',
  tabs,
  activeTab,
  onTabChange,
  onSearch
}: LayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          showBackButton={showBackButton} 
          backLabel={backLabel}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSearch={onSearch}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

