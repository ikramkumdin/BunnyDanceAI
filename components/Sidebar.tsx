'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Image, Grid3x3, Sparkles, Menu, X } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAgeVerified } = useStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Image, label: 'Assets', path: '/assets' },
    { icon: Grid3x3, label: 'Apps', path: '/apps' },
    { icon: Sparkles, label: 'Generate', path: '/generate', highlight: true },
  ];

  const isActive = (path: string, currentPath: string) => {
    // Home is only active on exact home path
    if (path === '/') return currentPath === '/';
    // Other paths check if current path starts with the item path
    return currentPath?.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    router.push(path);
    setIsMobileOpen(false); // Close mobile menu after navigation
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-900 p-2 rounded-lg border border-slate-800 text-gray-400 hover:text-white transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-4 transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Close button for mobile - positioned at top with spacing */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden absolute top-4 right-2 bg-slate-800 p-1.5 rounded-lg text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Spacer for mobile to push content down below close button */}
        <div className="lg:hidden h-10 w-full" />
        
        <div className="hidden lg:block">
          <Menu className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" />
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const currentPath = pathname || '';
          
          // Only one button should be active at a time
          // Generate is active only when on generate page
          // Other buttons are active when on their respective pages
          const active = isActive(item.path, currentPath);
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg transition-colors w-full h-16 ${
                active
                  ? 'bg-secondary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[10px] leading-tight text-center break-words">{item.label}</span>
            </button>
          );
        })}
        
        <div className="flex-1" />
        <div className="hidden lg:block">
          <Menu className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" />
        </div>
      </div>
    </>
  );
}

