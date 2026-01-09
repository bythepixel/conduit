# Code Simplification Opportunities

This document identifies logic throughout the application that could be simplified for better maintainability, readability, and reduced duplication.

## 🔴 High Priority - Significant Duplication

### 1. **Repeated Error Handling Pattern in Admin Components**

**Problem**: Multiple admin components have identical error handling patterns with `setModalConfig`:

**Files Affected**:
- `pages/admin/harvest-invoices.tsx` (3 functions: `handleSingleSync`, `handleCreateDeal`, `handleSyncDeal`)
- `pages/admin/slack-channels.tsx` (`handleConfirmSync`)
- `pages/admin/meeting-notes.tsx` (`handleSync`)
- `pages/admin/harvest-company-mappings.tsx` (`handleCreateMapping`, `handleDeleteMapping`)
- `pages/admin/fire-hook-logs.tsx` (`handleDelete`)

**Current Pattern** (repeated ~15+ times):
```typescript
try {
    const res = await fetch(...)
    const data = await res.json()
    if (res.ok) {
        setModalConfig({
            isOpen: true,
            type: 'success',
            title: 'Success',
            message: '...'
        })
        await fetchData()
    } else {
        setModalConfig({
            isOpen: true,
            type: 'error',
            title: 'Failed',
            message: data.error || 'Failed to...'
        })
    }
} catch (error: any) {
    setModalConfig({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: 'An error occurred: ' + (error.message || 'Unknown error')
    })
}
```

**Solution**: Create a reusable hook or utility function:
```typescript
// lib/hooks/useApiCall.ts or lib/utils/apiHelpers.ts
export function useApiCall() {
    const [modalConfig, setModalConfig] = useState<ModalConfig>({...})
    
    const callApi = async (
        url: string,
        options: RequestInit,
        onSuccess?: (data: any) => void,
        successMessage?: string
    ) => {
        try {
            const res = await fetch(url, options)
            const data = await res.json()
            if (res.ok) {
                if (onSuccess) await onSuccess(data)
                setModalConfig({
                    isOpen: true,
                    type: 'success',
                    title: 'Success',
                    message: successMessage || 'Operation completed successfully'
                })
                return { success: true, data }
            } else {
                setModalConfig({
                    isOpen: true,
                    type: 'error',
                    title: 'Failed',
                    message: data.error || 'Operation failed'
                })
                return { success: false, error: data.error }
            }
        } catch (error: any) {
            setModalConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'An error occurred: ' + (error.message || 'Unknown error')
            })
            return { success: false, error: error.message }
        }
    }
    
    return { callApi, modalConfig, setModalConfig }
}
```

**Impact**: Reduces ~200+ lines of duplicated code across admin components.

---

### 2. **Repeated Set State Management for Loading States**

**Problem**: Multiple components use the same pattern for managing loading states with Sets:

**Current Pattern** (repeated ~10+ times):
```typescript
// Adding to set
setSyncingInvoices(prev => {
    const newSet = new Set(prev)
    newSet.add(invoiceId)
    return newSet
})

// Removing from set
setSyncingInvoices(prev => {
    const newSet = new Set(prev)
    newSet.delete(invoiceId)
    return newSet
})
```

**Solution**: Create utility functions:
```typescript
// lib/utils/setHelpers.ts
export function addToSet<T>(set: Set<T>, item: T): Set<T> {
    return new Set(set).add(item)
}

export function removeFromSet<T>(set: Set<T>, item: T): Set<T> {
    const newSet = new Set(set)
    newSet.delete(item)
    return newSet
}

// Or create a custom hook
export function useSetState<T>(initial: Set<T> = new Set()) {
    const [set, setSet] = useState<Set<T>>(initial)
    
    const add = (item: T) => setSet(prev => new Set(prev).add(item))
    const remove = (item: T) => setSet(prev => {
        const newSet = new Set(prev)
        newSet.delete(item)
        return newSet
    })
    const toggle = (item: T) => setSet(prev => {
        const newSet = new Set(prev)
        if (newSet.has(item)) {
            newSet.delete(item)
        } else {
            newSet.add(item)
        }
        return newSet
    })
    const clear = () => setSet(new Set())
    
    return { set, add, remove, toggle, clear, setSet }
}
```

**Usage**:
```typescript
const { set: syncingInvoices, add: addSyncing, remove: removeSyncing } = useSetState<number>()

// Instead of:
setSyncingInvoices(prev => {
    const newSet = new Set(prev)
    newSet.add(invoiceId)
    return newSet
})

// Use:
addSyncing(invoiceId)
```

**Impact**: Reduces ~50+ lines of boilerplate code.

---

### 3. **Repeated Sync Result Message Formatting**

**Problem**: The same logic for formatting sync results with error counts appears in multiple places:

**Files**:
- `pages/admin/harvest-invoices.tsx` (`handleConfirmSync`)
- `pages/admin/slack-channels.tsx` (`handleConfirmSync`)
- `pages/admin/meeting-notes.tsx` (`handleSync`)

**Current Pattern**:
```typescript
const errorCount = data.results.errors?.length || 0
let message = `Sync completed!\nCreated: ${data.results.created}\nUpdated: ${data.results.updated}`
if (errorCount > 0) {
    message += `\n\nErrors: ${errorCount}`
    if (errorCount <= 10) {
        message += '\n\n' + data.results.errors.join('\n')
    } else {
        message += `\n\nFirst 10 errors:\n${data.results.errors.slice(0, 10).join('\n')}\n\n... and ${errorCount - 10} more`
    }
}
```

**Solution**: Extract to utility function:
```typescript
// lib/utils/formatHelpers.ts
export function formatSyncResults(results: {
    created: number
    updated: number
    errors?: string[]
}): string {
    const errorCount = results.errors?.length || 0
    let message = `Sync completed!\nCreated: ${results.created}\nUpdated: ${results.updated}`
    
    if (errorCount > 0) {
        message += `\n\nErrors: ${errorCount}`
        if (errorCount <= 10) {
            message += '\n\n' + results.errors!.join('\n')
        } else {
            message += `\n\nFirst 10 errors:\n${results.errors!.slice(0, 10).join('\n')}\n\n... and ${errorCount - 10} more`
        }
    }
    
    return message
}
```

**Impact**: Reduces ~30 lines of duplicated code.

---

## 🟡 Medium Priority - Code Clarity

### 4. **Simplified toggleExpand Function**

**Problem**: The `toggleExpand` function in `harvest-invoices.tsx` can be simplified:

**Current**:
```typescript
const toggleExpand = (invoiceId: number) => {
    const newExpanded = new Set(expandedInvoices)
    if (newExpanded.has(invoiceId)) {
        newExpanded.delete(invoiceId)
    } else {
        newExpanded.add(invoiceId)
    }
    setExpandedInvoices(newExpanded)
}
```

**Simplified**:
```typescript
const toggleExpand = (invoiceId: number) => {
    setExpandedInvoices(prev => {
        const newSet = new Set(prev)
        if (newSet.has(invoiceId)) {
            newSet.delete(invoiceId)
        } else {
            newSet.add(invoiceId)
        }
        return newSet
    })
}
```

**Or even better with the useSetState hook**:
```typescript
const { set: expandedInvoices, toggle: toggleExpand } = useSetState<number>()
// Then just call: toggleExpand(invoiceId)
```

---

### 5. **Complex Button Disabled/CSS Logic**

**Problem**: Repeated complex conditional logic for button states:

**Current Pattern** (appears ~10+ times):
```typescript
disabled={syncingInvoices.has(invoice.id) || syncing}
className={`p-2 rounded-lg transition-colors ${
    syncingInvoices.has(invoice.id) || syncing
        ? 'text-slate-500 cursor-not-allowed'
        : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-900/20'
}`}
```

**Solution**: Create utility function or component:
```typescript
// lib/utils/buttonHelpers.ts
export function getButtonClasses(
    isDisabled: boolean,
    enabledClasses: string,
    disabledClasses: string = 'text-slate-500 cursor-not-allowed'
): string {
    return `p-2 rounded-lg transition-colors ${isDisabled ? disabledClasses : enabledClasses}`
}

// Or create a reusable Button component
export function ActionButton({
    disabled,
    onClick,
    loading,
    icon,
    enabledColor = 'emerald',
    ...props
}: {
    disabled?: boolean
    onClick: () => void
    loading?: boolean
    icon: React.ReactNode
    enabledColor?: 'emerald' | 'blue' | 'green' | 'yellow'
}) {
    const isDisabled = disabled || loading
    const colorClasses = {
        emerald: 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-900/20',
        blue: 'text-blue-400 hover:text-blue-600 hover:bg-blue-900/20',
        green: 'text-green-400 hover:text-green-600 hover:bg-green-900/20',
        yellow: 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-900/20',
    }
    
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            className={`p-2 rounded-lg transition-colors ${
                isDisabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : colorClasses[enabledColor]
            }`}
            {...props}
        >
            {loading ? <Spinner /> : icon}
        </button>
    )
}
```

---

### 6. **Repeated Filter Logic**

**Problem**: Similar search/filter patterns appear in multiple components:

**Current Pattern** (in `harvest-invoices.tsx`):
```typescript
const filteredInvoices = invoices.filter(inv => {
    if (showOnlyNoMapping && inv.hasMapping !== false) {
        return false
    }
    if (!search.trim()) return true
    const searchLower = search.toLowerCase()
    const clientName = inv.clientName?.toLowerCase() || ''
    const number = inv.number?.toLowerCase() || ''
    const subject = inv.subject?.toLowerCase() || ''
    const harvestId = inv.harvestId.toLowerCase()
    return clientName.includes(searchLower) || 
           number.includes(searchLower) || 
           subject.includes(searchLower) ||
           harvestId.includes(searchLower)
})
```

**Solution**: Create reusable filter utility:
```typescript
// lib/utils/filterHelpers.ts
export function createSearchFilter<T>(
    items: T[],
    search: string,
    searchFields: (item: T) => string[]
): T[] {
    if (!search.trim()) return items
    
    const searchLower = search.toLowerCase()
    return items.filter(item => {
        const fieldValues = searchFields(item)
        return fieldValues.some(field => 
            field?.toLowerCase().includes(searchLower)
        )
    })
}

// Usage:
const filteredInvoices = createSearchFilter(
    invoices,
    search,
    (inv) => [
        inv.clientName || '',
        inv.number || '',
        inv.subject || '',
        inv.harvestId
    ]
).filter(inv => {
    if (showOnlyNoMapping && inv.hasMapping !== false) return false
    return true
})
```

---

## 🟢 Low Priority - Minor Improvements

### 7. **Repeated Formatting Functions**

**Problem**: `formatCurrency` and `formatDate` appear in multiple components with slight variations.

**Solution**: Move to shared utility file:
```typescript
// lib/utils/formatHelpers.ts
export function formatCurrency(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount === null || amount === undefined) return 'N/A'
    const currencyCode = currency || 'USD'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
    }).format(amount)
}

export function formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}
```

---

### 8. **Repeated Loading State Checks**

**Problem**: Similar loading/authentication checks appear in multiple components:

**Current Pattern**:
```typescript
if (status === "loading" || !session) return <div>Loading...</div>
```

**Solution**: Create a shared component or hook:
```typescript
// components/AuthGuard.tsx or lib/hooks/useAuthGuard.ts
export function useAuthGuard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        }
    }, [status, router])
    
    if (status === "loading" || !session) {
        return { loading: true }
    }
    
    return { loading: false, session }
}
```

---

## 📊 Summary

### Estimated Impact:
- **High Priority**: ~280+ lines of code reduction
- **Medium Priority**: ~100+ lines of code reduction  
- **Low Priority**: ~50+ lines of code reduction
- **Total**: ~430+ lines of duplicated code that could be simplified

### Recommended Implementation Order:
1. Create `useSetState` hook (quick win, high impact)
2. Create `formatSyncResults` utility (quick win, medium impact)
3. Create `useApiCall` hook or similar (larger refactor, highest impact)
4. Create reusable button components (medium effort, good UX improvement)
5. Extract formatting utilities (low effort, good organization)

### Benefits:
- **Reduced Duplication**: Less code to maintain
- **Easier Testing**: Centralized logic is easier to test
- **Consistency**: Shared utilities ensure consistent behavior
- **Readability**: Components become more focused on their specific logic
- **Bug Fixes**: Fix bugs once instead of in multiple places
