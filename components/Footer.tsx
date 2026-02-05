'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-slate-950 text-gray-400 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm">
            © {new Date().getFullYear()} WaifuDance AI (ASMRTTS). All Rights Reserved.
          </div>
          <div className="flex gap-6 text-sm">
            <Link 
              href="/terms" 
              className="hover:text-primary transition-colors"
            >
              Terms of Service
            </Link>
            <a 
              href="mailto:support@waifudance.com" 
              className="hover:text-primary transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
