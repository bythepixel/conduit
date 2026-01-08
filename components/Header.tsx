
import Link from 'next/link'
import { signOut, useSession } from "next-auth/react"
import { ReactNode, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

type HeaderProps = {
    action?: ReactNode
}

export default function Header({ action }: HeaderProps) {
    const { data: session } = useSession()
    const router = useRouter()
    const [menuOpen, setMenuOpen] = useState(false)
    const [navOpen, setNavOpen] = useState(false)
    const [slackyHubOpen, setSlackyHubOpen] = useState(false)
    const [fireSpotOpen, setFireSpotOpen] = useState(false)
    const [hubvestOpen, setHubvestOpen] = useState(false)
    const [mobileSlackyHubOpen, setMobileSlackyHubOpen] = useState(false)
    const [mobileFireSpotOpen, setMobileFireSpotOpen] = useState(false)
    const [mobileHubvestOpen, setMobileHubvestOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const navRef = useRef<HTMLDivElement>(null)
    const hamburgerRef = useRef<HTMLButtonElement>(null)
    const slackyHubRef = useRef<HTMLDivElement>(null)
    const fireSpotRef = useRef<HTMLDivElement>(null)
    const hubvestRef = useRef<HTMLDivElement>(null)

    const isActive = (path: string) => router.pathname === path

    // Check if any SlackyHub child is active
    const isSlackyHubActive = () => {
        return isActive('/') || 
               isActive('/admin/prompts') || 
               isActive('/admin/slack-channels') || 
               isActive('/admin/hubspot-companies') || 
               isActive('/admin/cron-logs')
    }

    // Check if FireSpot child is active
    const isFireSpotActive = () => {
        return isActive('/admin/meeting-notes') || isActive('/admin/hubspot-companies') || isActive('/admin/fire-hook-logs')
    }

    // Check if Hubvest child is active
    const isHubvestActive = () => {
        return isActive('/admin/harvest-invoices') || isActive('/admin/harvest-invoice-cron-logs')
    }

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            
            // Don't close if clicking the hamburger button itself
            if (hamburgerRef.current && hamburgerRef.current.contains(target)) {
                return
            }
            
            if (menuRef.current && !menuRef.current.contains(target)) {
                setMenuOpen(false)
            }
            if (navRef.current && !navRef.current.contains(target)) {
                setNavOpen(false)
            }
            if (slackyHubRef.current && !slackyHubRef.current.contains(target)) {
                setSlackyHubOpen(false)
            }
            if (fireSpotRef.current && !fireSpotRef.current.contains(target)) {
                setFireSpotOpen(false)
            }
            if (hubvestRef.current && !hubvestRef.current.contains(target)) {
                setHubvestOpen(false)
            }
        }

        if (menuOpen || navOpen || slackyHubOpen || fireSpotOpen || hubvestOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [menuOpen, navOpen, slackyHubOpen, fireSpotOpen, hubvestOpen])

    // Close mobile nav when route changes
    useEffect(() => {
        setNavOpen(false)
    }, [router.pathname])

    return (
        <div className="w-full bg-slate-800/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <Link href="/">
                            <a className="block group flex items-center gap-3">
                                <div className="flex-shrink-0">
                                    <img 
                                        src="/conduit-logo.svg" 
                                        alt="Conduit Logo" 
                                        className="w-8 h-8 sm:w-10 sm:h-10 group-hover:opacity-80 transition-opacity"
                                    />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 via-pink-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient group-hover:opacity-80 transition-opacity">
                                    Conduit
                                </h1>
                            </a>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-1 bg-slate-700/50 p-1 rounded-xl flex-shrink-0">
                        {/* SlackyHub Dropdown */}
                        <div className="relative" ref={slackyHubRef}>
                            <button
                                onClick={() => setSlackyHubOpen(!slackyHubOpen)}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                                    isSlackyHubActive()
                                        ? 'bg-slate-600 text-indigo-400 shadow-sm'
                                        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                                }`}
                            >
                                SlackyHub
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className={`transition-transform ${slackyHubOpen ? 'rotate-180' : ''}`}
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {slackyHubOpen && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden z-50">
                                    <Link href="/">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Mappings
                                        </a>
                                    </Link>
                                    <Link href="/admin/prompts">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/prompts')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Prompts
                                        </a>
                                    </Link>
                                    <Link href="/admin/slack-channels">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/slack-channels')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Channels
                                        </a>
                                    </Link>
                                    <Link href="/admin/hubspot-companies">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/hubspot-companies')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Companies
                                        </a>
                                    </Link>
                                    <Link href="/admin/cron-logs">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/cron-logs')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Cron Logs
                                        </a>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* FireSpot Dropdown */}
                        <div className="relative" ref={fireSpotRef}>
                            <button
                                onClick={() => setFireSpotOpen(!fireSpotOpen)}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                                    isFireSpotActive()
                                        ? 'bg-slate-600 text-indigo-400 shadow-sm'
                                        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                                }`}
                            >
                                FireSpot
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className={`transition-transform ${fireSpotOpen ? 'rotate-180' : ''}`}
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {fireSpotOpen && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden z-50">
                                    <Link href="/admin/meeting-notes">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/meeting-notes')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Meeting Notes
                                        </a>
                                    </Link>
                                    <Link href="/admin/hubspot-companies">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/hubspot-companies')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Companies
                                        </a>
                                    </Link>
                                    <Link href="/admin/fire-hook-logs">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/fire-hook-logs')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Fire Hook Logs
                                        </a>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Hubvest Dropdown */}
                        <div className="relative" ref={hubvestRef}>
                            <button
                                onClick={() => setHubvestOpen(!hubvestOpen)}
                                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                                    isHubvestActive()
                                        ? 'bg-slate-600 text-indigo-400 shadow-sm'
                                        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                                }`}
                            >
                                Hubvest
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="14" 
                                    height="14" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                    className={`transition-transform ${hubvestOpen ? 'rotate-180' : ''}`}
                                >
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            {hubvestOpen && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden z-50">
                                    <Link href="/admin/harvest-invoices">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/harvest-invoices')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Harvest Invoices
                                        </a>
                                    </Link>
                                    <Link href="/admin/harvest-invoice-cron-logs">
                                        <a className={`block px-4 py-2 text-sm transition-colors ${
                                            isActive('/admin/harvest-invoice-cron-logs')
                                                ? 'bg-slate-700 text-indigo-400'
                                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                        }`}>
                                            Cron Logs
                                        </a>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Users - No dropdown */}
                        <Link href="/admin/users">
                            <a className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${isActive('/admin/users')
                                ? 'bg-slate-600 text-indigo-400 shadow-sm'
                                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                                }`}>
                                Users
                            </a>
                        </Link>
                    </nav>

                    {/* Right side: Action + User Menu */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {action && <div className="hidden sm:block">{action}</div>}

                        <div className="h-6 w-px bg-slate-600 hidden lg:block"></div>

                        {/* Hamburger Menu Button (Mobile/Tablet) */}
                        <button
                            ref={hamburgerRef}
                            onClick={(e) => {
                                e.stopPropagation()
                                setNavOpen(prev => !prev)
                            }}
                            className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                            aria-label="Toggle navigation menu"
                            aria-expanded={navOpen}
                        >
                            {navOpen ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="12" x2="21" y2="12"></line>
                                    <line x1="3" y1="6" x2="21" y2="6"></line>
                                    <line x1="3" y1="18" x2="21" y2="18"></line>
                                </svg>
                            )}
                        </button>

                        {/* User Menu */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-slate-700 hover:ring-indigo-400 transition-all cursor-pointer"
                                title="User Menu"
                            >
                                {session?.user?.name?.[0] || 'U'}
                            </button>

                            {/* User Dropdown Menu */}
                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50">
                                    <div className="p-4 border-b border-slate-700">
                                        <p className="text-sm font-bold text-slate-100">{session?.user?.name}</p>
                                        <p className="text-xs text-slate-400 font-mono mt-1">{session?.user?.email}</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false)
                                                signOut()
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm font-semibold"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Menu */}
                {navOpen && (
                    <div ref={navRef} className="lg:hidden border-t border-slate-700 py-4">
                        <nav className="flex flex-col space-y-1">
                            {/* SlackyHub Dropdown - Mobile */}
                            <div>
                                <button
                                    onClick={() => setMobileSlackyHubOpen(!mobileSlackyHubOpen)}
                                    className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                                        isSlackyHubActive()
                                            ? 'bg-slate-700 text-indigo-400'
                                            : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                    }`}
                                >
                                    SlackyHub
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                        className={`transition-transform ${mobileSlackyHubOpen ? 'rotate-180' : ''}`}
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                {mobileSlackyHubOpen && (
                                    <div className="pl-4 mt-1 space-y-1">
                                        <Link href="/">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Slack Mappings
                                            </a>
                                        </Link>
                                        <Link href="/admin/prompts">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/prompts')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Prompts
                                            </a>
                                        </Link>
                                        <Link href="/admin/slack-channels">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/slack-channels')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Channels
                                            </a>
                                        </Link>
                                        <Link href="/admin/hubspot-companies">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/hubspot-companies')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Companies
                                            </a>
                                        </Link>
                                        <Link href="/admin/cron-logs">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/cron-logs')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Cron Logs
                                            </a>
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* FireSpot Dropdown - Mobile */}
                            <div>
                                <button
                                    onClick={() => setMobileFireSpotOpen(!mobileFireSpotOpen)}
                                    className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                                        isFireSpotActive()
                                            ? 'bg-slate-700 text-indigo-400'
                                            : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                    }`}
                                >
                                    FireSpot
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                        className={`transition-transform ${mobileFireSpotOpen ? 'rotate-180' : ''}`}
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                {mobileFireSpotOpen && (
                                    <div className="pl-4 mt-1 space-y-1">
                                        <Link href="/admin/meeting-notes">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/meeting-notes')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Meeting Notes
                                            </a>
                                        </Link>
                                        <Link href="/admin/hubspot-companies">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/hubspot-companies')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Companies
                                            </a>
                                        </Link>
                                        <Link href="/admin/fire-hook-logs">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/fire-hook-logs')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Fire Hook Logs
                                            </a>
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Hubvest Dropdown - Mobile */}
                            <div>
                                <button
                                    onClick={() => setMobileHubvestOpen(!mobileHubvestOpen)}
                                    className={`w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                                        isHubvestActive()
                                            ? 'bg-slate-700 text-indigo-400'
                                            : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                    }`}
                                >
                                    Hubvest
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                        className={`transition-transform ${mobileHubvestOpen ? 'rotate-180' : ''}`}
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                {mobileHubvestOpen && (
                                    <div className="pl-4 mt-1 space-y-1">
                                        <Link href="/admin/harvest-invoices">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/harvest-invoices')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Harvest Invoices
                                            </a>
                                        </Link>
                                        <Link href="/admin/harvest-invoice-cron-logs">
                                            <a className={`block px-4 py-2 rounded-lg text-sm transition-all ${
                                                isActive('/admin/harvest-invoice-cron-logs')
                                                    ? 'bg-slate-700 text-indigo-400'
                                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                            }`}>
                                                Cron Logs
                                            </a>
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Users - No dropdown */}
                            <Link href="/admin/users">
                                <a className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${isActive('/admin/users')
                                    ? 'bg-slate-700 text-indigo-400'
                                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                                    }`}>
                                    Users
                                </a>
                            </Link>
                            {action && (
                                <div className="px-4 py-3 border-t border-slate-700 mt-2">
                                    {action}
                                </div>
                            )}
                        </nav>
                    </div>
                )}
            </div>
        </div>
    )
}
