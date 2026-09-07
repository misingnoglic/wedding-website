'use client'

import { TabType } from '../types'
import { useState } from 'react'

interface AdminSidebarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  counts: {
    families: number
    guests: number
    messages: number
    dietary: number
    travel: number
    songs: number
    activity: number
  }
}

export default function AdminSidebar({ activeTab, setActiveTab, counts }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tabs = [
    { id: 'families', label: 'Party Overview', count: counts.families, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'guests', label: 'All Guests', count: counts.guests, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'messages', label: 'SMS Messages', count: counts.messages, icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'dietary', label: 'Dietary & Catering', count: counts.dietary, icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'travel', label: 'Flights & Hotel', count: counts.travel, icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'songs', label: 'Song Requests', count: counts.songs, icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
    { id: 'activity', label: 'Activity Log', count: counts.activity, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  ]

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-black text-white rounded-full shadow-2xl shadow-black/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          )}
        </svg>
      </button>

      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen lg:h-[calc(100vh-2rem)] w-72 lg:w-64 flex flex-col
        bg-white/90 lg:bg-white/60 backdrop-blur-xl border-r border-zinc-200/50 lg:rounded-3xl lg:border lg:shadow-xl lg:mt-4 lg:ml-4 z-50 lg:z-0
        transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-black">A & C</h2>
              <p className="text-[10px] uppercase font-karla tracking-widest text-zinc-500">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 group cursor-pointer ${
                  isActive 
                    ? 'bg-black text-white shadow-md shadow-black/10' 
                    : 'text-zinc-500 hover:bg-zinc-100/80 hover:text-black'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-black'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span className={`text-sm font-sans tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>
                    {tab.label}
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-zinc-200/50 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-black'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-zinc-200/50">
           <div className="px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-xs font-karla text-zinc-600">System Online</span>
           </div>
        </div>
      </aside>
    </>
  )
}
