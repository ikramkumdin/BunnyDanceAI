'use client';

import { ReactNode, useState } from 'react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header 
          showBackButton={showBackButton} 
          backLabel={backLabel}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onSearch={onSearch}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}

