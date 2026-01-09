import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

/**
 * Custom hook for handling authentication and redirects
 */
export function useAuthGuard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin')
        }
    }, [status, router])
    
    const isLoading = status === 'loading' || !session
    const isAuthenticated = status === 'authenticated' && !!session
    
    return {
        session,
        status,
        isLoading,
        isAuthenticated
    }
}
