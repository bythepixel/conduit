import { render, screen, fireEvent } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

import Header from '../../components/Header'

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('Header component', () => {
  const mockRouter = {
    pathname: '/',
    push: jest.fn(),
    replace: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter as any)
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
        },
      },
      status: 'authenticated',
    } as any)
  })

  it('should render the header with title', () => {
    render(<Header />)
    
    expect(screen.getByText('Slacky Hub')).toBeInTheDocument()
    expect(screen.getByText('Slack AI ↔ HubSpot')).toBeInTheDocument()
  })

  it('should render navigation links', () => {
    render(<Header />)
    
    expect(screen.getByText('Mappings')).toBeInTheDocument()
    expect(screen.getByText('Prompts')).toBeInTheDocument()
    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('should show user initial in circle', () => {
    render(<Header />)
    
    const userButton = screen.getByTitle('User Menu')
    expect(userButton).toBeInTheDocument()
    expect(userButton).toHaveTextContent('T')
  })

  it('should open dropdown menu when user circle is clicked', () => {
    render(<Header />)
    
    const userButton = screen.getByTitle('User Menu')
    fireEvent.click(userButton)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()
  })

  it('should call signOut when Sign Out button is clicked', () => {
    render(<Header />)
    
    const userButton = screen.getByTitle('User Menu')
    fireEvent.click(userButton)
    
    const signOutButton = screen.getByText('Sign Out')
    fireEvent.click(signOutButton)
    
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('should highlight active route', () => {
    mockRouter.pathname = '/admin/prompts'
    render(<Header />)
    
    const promptsLink = screen.getByText('Prompts').closest('a')
    expect(promptsLink).toHaveClass('bg-slate-600')
  })
})

