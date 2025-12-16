
import Link from 'next/link'
import { signOut, useSession } from "next-auth/react"
import { ReactNode } from 'react'
import { useRouter } from 'next/router'

type HeaderProps = {
    action?: ReactNode
}

export default function Header({ action }: HeaderProps) {
    const { data: session } = useSession()
    const router = useRouter()

    const isActive = (path: string) => router.pathname === path

    return (
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-700 mb-8 sticky top-4 z-50">
            <div className="flex items-center gap-8 mb-4 md:mb-0">
                <div>
                    <Link href="/">
                        <a className="block group">
                            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                                Slacky Hub
                            </h1>
                            <p className="text-slate-400 text-xs font-medium tracking-wide mt-1 group-hover:text-slate-300 transition-colors">
                                Slack AI ↔ HubSpot
                            </p>
                        </a>
                    </Link>
                </div>

                <nav className="hidden md:flex items-center gap-1 bg-slate-700/50 p-1 rounded-xl">
                    <Link href="/">
                        <a className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/')
                            ? 'bg-slate-600 text-indigo-400 shadow-sm'
                            : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                            }`}>
                            Dashboard
                        </a>
                    </Link>
                    <Link href="/admin/users">
                        <a className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/admin/users')
                            ? 'bg-slate-600 text-indigo-400 shadow-sm'
                            : 'text-slate-300 hover:text-slate-100 hover:bg-slate-600/50'
                            }`}>
                            Users
                        </a>
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {action}

                <div className="h-8 w-px bg-slate-600 mx-2 hidden md:block"></div>

                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-100">{session?.user?.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{session?.user?.email}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-slate-700">
                        {session?.user?.name?.[0] || 'U'}
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors ml-1"
                        title="Sign Out"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
