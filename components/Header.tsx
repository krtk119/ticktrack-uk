"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MapPin, BookOpen, PlusCircle, Menu, X, ShieldAlert } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Map", href: "/", icon: MapPin },
    { name: "Learn", href: "/learn", icon: BookOpen },
    { name: "Report a sighting", href: "/report", icon: PlusCircle },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-900 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-sm shadow-emerald-700/20 group-hover:bg-emerald-800 transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight block text-slate-900">
                TickTrack <span className="text-emerald-700 font-extrabold">UK</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block -mt-1">
                Tick sightings
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
