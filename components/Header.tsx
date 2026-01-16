'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Gem, Upload, Search, Camera, Menu } from 'lucide-react';
import { useStore } from '@/store/useStore';
import Logo from './Logo';

interface HeaderProps {
  showBackButton?: boolean;
  backLabel?: string;
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onSearch?: (query: string) => void;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

export default function Header({ 
  showBackButton = false, 
  backLabel = '',
  tabs,
  activeTab,
  onTabChange,
  onSearch,
  isMobileMenuOpen = false,
  setIsMobileMenuOpen
}: HeaderProps) {
  const router = useRouter();
  const { user } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
  };

  const handleUploadClick = () => {
    router.push('/generate');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 fixed top-0 left-0 right-0 z-30 lg:static">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {/* Mobile Hamburger Button - inside header */}
        {!showBackButton && setIsMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        {!showBackButton && (
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
        )}
        {!showBackButton && (
          <div className="hidden lg:block">
            <Logo size="sm" />
          </div>
        )}
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {backLabel && <h1 className="text-lg sm:text-xl font-semibold flex-shrink-0 hidden sm:block">{backLabel}</h1>}
        
        {/* Search Bar */}
        {!showBackButton && (
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (onSearch) {
                    onSearch(e.target.value);
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 sm:pl-10 pr-4 py-1.5 sm:py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </form>
        )}
        
        {tabs && (
          <div className="flex gap-1 sm:gap-2 ml-2 sm:ml-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.value
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
        {showBackButton && (
          <button
            onClick={handleUploadClick}
            className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-colors font-semibold text-sm sm:text-base"
          >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden md:inline">Start with a photo</span>
            <span className="md:hidden">Start</span>
          </button>
        )}
        {!showBackButton && (
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-1 sm:gap-2 bg-primary hover:bg-primary-dark text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors font-medium text-xs sm:text-sm"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Upload a photo</span>
            <span className="sm:hidden">Upload</span>
          </button>
        )}
        <button className="hidden sm:flex items-center gap-1 sm:gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden md:inline">Join us</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span className="text-xs sm:text-sm font-semibold">{user?.credits ?? 0}</span>
        </div>
      </div>
    </header>
  );
}

