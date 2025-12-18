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
    
    expect(screen.getByText('Conduit')).toBeInTheDocument()
    // Subtitle removed in new design, so we don't check for it
  })

  it('should render navigation links', () => {
    render(<Header />)
    
    // On desktop, links are in dropdowns - open SlackyHub dropdown
    const slackyHubButton = screen.getByText('SlackyHub')
    fireEvent.click(slackyHubButton)
    
    // Now the dropdown items should be visible
    expect(screen.getByText('Slack Mappings')).toBeInTheDocument()
    expect(screen.getByText('Prompts')).toBeInTheDocument()
    expect(screen.getByText('Channels')).toBeInTheDocument()
    expect(screen.getByText('Companies')).toBeInTheDocument()
    expect(screen.getByText('Cron Logs')).toBeInTheDocument()
    
    // Open FireSpot dropdown
    const fireSpotButton = screen.getByText('FireSpot')
    fireEvent.click(fireSpotButton)
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument()
    
    // Users should be directly visible (no dropdown)
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
    
    // Open SlackyHub dropdown to see the links
    const slackyHubButton = screen.getByText('SlackyHub')
    fireEvent.click(slackyHubButton)
    
    const promptsLink = screen.getByText('Prompts').closest('a')
    expect(promptsLink).toHaveClass('bg-slate-700')
  })

  it('should highlight Cron Logs when active', () => {
    mockRouter.pathname = '/admin/cron-logs'
    render(<Header />)
    
    // Open SlackyHub dropdown to see the links
    const slackyHubButton = screen.getByText('SlackyHub')
    fireEvent.click(slackyHubButton)
    
    const cronLogsLink = screen.getByText('Cron Logs').closest('a')
    expect(cronLogsLink).toHaveClass('bg-slate-700')
  })
})

