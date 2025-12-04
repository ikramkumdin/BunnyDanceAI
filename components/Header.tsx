'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Gem, Upload, Search, Camera } from 'lucide-react';
import { useStore } from '@/store/useStore';
import Logo from './Logo';

interface HeaderProps {
  showBackButton?: boolean;
  backLabel?: string;
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onSearch?: (query: string) => void;
}

export default function Header({ 
  showBackButton = false, 
  backLabel = '',
  tabs,
  activeTab,
  onTabChange,
  onSearch
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
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {!showBackButton && <Logo size="sm" />}
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {backLabel && <h1 className="text-xl font-semibold flex-shrink-0">{backLabel}</h1>}
        
        {/* Search Bar */}
        {!showBackButton && (
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </form>
        )}
        
        {tabs && (
          <div className="flex gap-2 ml-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
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

      <div className="flex items-center gap-4 flex-shrink-0">
        {showBackButton && (
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors font-semibold"
          >
            <Camera className="w-5 h-5" />
            <span>Start with a photo</span>
          </button>
        )}
        {!showBackButton && (
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Upload a photo</span>
          </button>
        )}
        <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm">Join us</span>
        </button>
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold">{user?.credits ?? 0}</span>
        </div>
      </div>
    </header>
  );
}

