import { useState } from 'react'

/**
 * Custom hook for managing Set state with convenient add/remove/toggle operations
 */
export function useSetState<T>(initial: Set<T> = new Set()) {
    const [set, setSet] = useState<Set<T>>(initial)
    
    const add = (item: T) => {
        setSet(prev => {
            const newSet = new Set(prev)
            newSet.add(item)
            return newSet
        })
    }
    
    const remove = (item: T) => {
        setSet(prev => {
            const newSet = new Set(prev)
            newSet.delete(item)
            return newSet
        })
    }
    
    const toggle = (item: T) => {
        setSet(prev => {
            const newSet = new Set(prev)
            if (newSet.has(item)) {
                newSet.delete(item)
            } else {
                newSet.add(item)
            }
            return newSet
        })
    }
    
    const clear = () => {
        setSet(new Set())
    }
    
    const has = (item: T) => set.has(item)
    
    return { set, add, remove, toggle, clear, has, setSet }
}
