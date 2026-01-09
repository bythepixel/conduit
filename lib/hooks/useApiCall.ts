import { useState } from 'react'

type ModalType = 'error' | 'success' | 'info'

interface ModalConfig {
    isOpen: boolean
    type: ModalType
    title: string
    message: string
}

interface ApiCallOptions {
    url: string
    method?: string
    body?: any
    headers?: Record<string, string>
    onSuccess?: (data: any) => void | Promise<void>
    successMessage?: string
    successTitle?: string
    errorTitle?: string
}

/**
 * Custom hook for making API calls with consistent error handling and modal management
 */
export function useApiCall() {
    const [modalConfig, setModalConfig] = useState<ModalConfig>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    })
    
    const callApi = async (options: ApiCallOptions) => {
        const {
            url,
            method = 'POST',
            body,
            headers = { 'Content-Type': 'application/json' },
            onSuccess,
            successMessage = 'Operation completed successfully',
            successTitle = 'Success',
            errorTitle = 'Error'
        } = options
        
        try {
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            })
            
            const data = await res.json()
            
            if (res.ok) {
                if (onSuccess) {
                    await onSuccess(data)
                }
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: successTitle,
                    message: successMessage
                })
                return { success: true, data }
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: errorTitle,
                    message: data.error || 'Operation failed'
                })
                return { success: false, error: data.error }
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: errorTitle,
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
            return { success: false, error: error.message }
        }
    }
    
    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }))
    }
    
    return { callApi, modalConfig, setModalConfig, closeModal }
}
