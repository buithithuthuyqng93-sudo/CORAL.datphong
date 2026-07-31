import React from 'react';
import { Home, LayoutGrid, GitBranch, Settings, Hotel, Phone, MapPin, Sparkles, Lock } from 'lucide-react';
import { PropertyConfig } from '../types';

interface HeaderProps {
  activeTab: 'guest-website' | 'pms-channel' | 'admin-manager' | 'architecture';
  setActiveTab: (tab: 'guest-website' | 'pms-channel' | 'admin-manager' | 'architecture') => void;
  bookingCount: number;
  propertyConfig?: PropertyConfig;
  isAuthenticated?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  bookingCount,
  propertyConfig,
  isAuthenticated,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#151B17] text-[#FAF8F5] border-b border-[#2C3831] shadow-xl">
      {/* Top Banner Notice - Dynamic from Property Config */}
      <div className="bg-[#111613] text-[#D5CBBF] text-xs px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between border-b border-[#232D27]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C8A261] animate-pulse"></span>
          <span className="font-medium text-[#EAE4DC] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C8A261]" />
            {propertyConfig?.announcementBar || 'Homestay & CAFE CORAL Lý Sơn (Bungalow Vòm Cliffside 15 Căn)'}
          </span>
        </div>

        <div className="flex items-center gap-5 text-xs text-[#B8A99A]">
          <span className="flex items-center gap-1 hover:text-[#C8A261] transition-colors">
            <MapPin className="w-3.5 h-3.5 text-[#C8A261]" /> {propertyConfig?.address || 'Đặc khu Lý Sơn - Quảng Ngãi'}
          </span>
          <span className="hidden sm:flex items-center gap-1 hover:text-[#C8A261] transition-colors">
            <Phone className="w-3.5 h-3.5 text-[#C8A261]" /> Hotline / Zalo: <strong className="text-[#FAF8F5]">{propertyConfig?.hotline || '0868011799'} ({propertyConfig?.ownerName || 'Mr Thiện'})</strong>
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5 cursor-pointer group" onClick={() => setActiveTab('guest-website')}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8A261] to-[#9E7A3B] flex items-center justify-center text-[#151B17] font-bold shadow-md shadow-[#C8A261]/20 group-hover:scale-105 transition-transform duration-300">
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#FAF8F5] tracking-wider uppercase leading-none">
                  {propertyConfig?.propertyName || 'HOMESTAY & CAFE CORAL'}
                </h1>
                <span className="bg-[#C8A261]/15 text-[#C8A261] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#C8A261]/30 uppercase tracking-widest">
                  Lý Sơn
                </span>
              </div>
              <p className="text-[11px] text-[#A39687] tracking-widest uppercase font-light mt-1">
                {propertyConfig?.tagline || 'Cliffside Bungalow & Coffee'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-[#1B231E] p-1.5 rounded-xl border border-[#2D3931]">
            <button
              onClick={() => setActiveTab('guest-website')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'guest-website'
                  ? 'bg-[#C8A261] text-[#151B17] font-bold shadow-md'
                  : 'text-[#D5CBBF] hover:text-white hover:bg-[#253029]'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Website Đặt Phòng Direct</span>
            </button>

            <button
              onClick={() => setActiveTab('pms-channel')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'pms-channel'
                  ? 'bg-[#C8A261] text-[#151B17] font-bold shadow-md'
                  : 'text-[#D5CBBF] hover:text-white hover:bg-[#253029]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Sơ Đồ 15 Phòng & OTA</span>
              {bookingCount > 0 && (
                <span className="bg-[#151B17] text-[#C8A261] border border-[#C8A261]/40 font-bold text-[10px] px-2 py-0.5 rounded-full">
                  {bookingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('admin-manager')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'admin-manager'
                  ? 'bg-[#C8A261] text-[#151B17] font-bold shadow-md'
                  : 'text-[#D5CBBF] hover:text-white hover:bg-[#253029]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Dashboard Quản Trị</span>
              {!isAuthenticated && <Lock className="w-3 h-3 text-rose-400" />}
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'architecture'
                  ? 'bg-[#C8A261] text-[#151B17] font-bold shadow-md'
                  : 'text-[#D5CBBF] hover:text-white hover:bg-[#253029]'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              <span>Sơ Đồ Giải Pháp</span>
              {!isAuthenticated && <Lock className="w-3 h-3 text-rose-400" />}
            </button>
          </nav>
        </div>

        {/* Mobile Navigation */}
        <div className="flex lg:hidden overflow-x-auto py-2.5 gap-2 scrollbar-none border-t border-[#253029]">
          <button
            onClick={() => setActiveTab('guest-website')}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              activeTab === 'guest-website' ? 'bg-[#C8A261] text-[#151B17] font-bold' : 'bg-[#1B231E] text-[#D5CBBF]'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Rooms & Suites
          </button>
          <button
            onClick={() => setActiveTab('pms-channel')}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              activeTab === 'pms-channel' ? 'bg-[#C8A261] text-[#151B17] font-bold' : 'bg-[#1B231E] text-[#D5CBBF]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Sơ Đồ 15 Phòng
          </button>
          <button
            onClick={() => setActiveTab('admin-manager')}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              activeTab === 'admin-manager' ? 'bg-[#C8A261] text-[#151B17] font-bold' : 'bg-[#1B231E] text-[#D5CBBF]'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Dashboard Quản Trị
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              activeTab === 'architecture' ? 'bg-[#C8A261] text-[#151B17] font-bold' : 'bg-[#1B231E] text-[#D5CBBF]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Sơ Đồ
          </button>
        </div>
      </div>
    </header>
  );
};

