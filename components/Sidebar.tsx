'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Image, Grid3x3, Sparkles, Menu } from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAgeVerified } = useStore();

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

  return (
    <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 gap-4">
      <Menu className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" />
      
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
            onClick={() => router.push(item.path)}
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
      <Menu className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" />
    </div>
  );
}

