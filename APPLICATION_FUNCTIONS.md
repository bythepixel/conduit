# Slacky Hub - Application Functions Documentation

## Overview

Slacky Hub is a Next.js application that automates the synchronization of Slack channel conversations to HubSpot company notes. It provides a comprehensive admin interface for managing mappings, users, channels, companies, and AI prompts, with automated scheduled syncing based on configurable cadences.

---

## Core Functionality

### 1. Slack to HubSpot Synchronization

**Purpose**: Automatically fetch messages from Slack channels, generate AI-powered summaries, and create notes in HubSpot companies.

**Key Features**:
- **Multi-Channel Support**: Each mapping can connect multiple Slack channels to a single HubSpot company
- **AI-Powered Summaries**: Uses OpenAI GPT-3.5-turbo to generate intelligent summaries of Slack conversations
- **User ID Replacement**: Automatically replaces Slack user IDs with full names from the local user database
- **Rate Limiting Protection**: Implements delays and error handling to prevent API rate limit issues
- **Auto-Join Channels**: Automatically joins Slack channels if the bot is not already a member

**Sync Process**:
1. Fetches recent messages from all mapped Slack channels
2. Replaces Slack user IDs with full names (first name + last name)
3. Formats messages for AI processing
4. Generates summary using active ChatGPT prompt
5. Creates note in HubSpot company with the summary
6. Logs all operations for audit and debugging

**API Endpoint**: `POST /api/sync`
- Supports manual triggering for individual mappings
- Supports scheduled cron job execution
- Returns detailed results for each mapping processed

---

### 2. Mapping Management

**Purpose**: Create and manage relationships between Slack channels and HubSpot companies.

**Features**:
- **Many-to-One Relationships**: Multiple Slack channels can be mapped to a single HubSpot company
- **Cadence Configuration**: Set sync frequency (Daily, Weekly, Monthly)
- **Title Assignment**: Optional titles for easy identification
- **Manual Sync**: Trigger immediate sync for individual mappings
- **Test Sync**: Test individual mappings without creating HubSpot notes

**Cadence Behavior**:
- **Daily**: Syncs on all weekdays (Monday-Friday)
- **Weekly**: Syncs only on Fridays
- **Monthly**: Syncs only on the last day of the month

**UI Location**: Home page (`/`)

**API Endpoints**:
- `GET /api/slack-mappings` - List all slack mappings
- `POST /api/slack-mappings` - Create new slack mapping
- `PUT /api/slack-mappings/[id]` - Update slack mapping
- `DELETE /api/slack-mappings/[id]` - Delete slack mapping

---

### 3. User Management

**Purpose**: Manage application users with role-based access control.

**Features**:
- **Admin-Only Access**: Only users marked as `isAdmin` can log in
- **Slack Integration**: Users can be synced from Slack with automatic `slackId` population
- **Password Management**: Secure password hashing with bcrypt
- **Optional Email**: Email addresses are optional
- **User Sync**: Bulk import users from Slack workspace

**User Fields**:
- First Name (required)
- Last Name (required)
- Email (optional, unique)
- Password (required for new users, optional for updates)
- Slack ID (optional, unique, auto-populated from sync)
- Admin Flag (boolean, defaults to false)

**UI Location**: `/admin/users`

**API Endpoints**:
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user
- `POST /api/users/sync` - Sync users from Slack

**Sync Functionality**:
- Fetches all users from Slack workspace
- Creates new users or updates existing ones
- Matches by email or Slack ID
- Generates temporary passwords for new users
- Preserves existing passwords during updates

---

### 4. Slack Channel Management

**Purpose**: Manage Slack channels used in mappings.

**Features**:
- **Manual Entry**: Create channels manually with channel ID and name
- **Bulk Sync**: Sync all channels from Slack workspace
- **Live Search**: Real-time filtering of channels
- **Usage Tracking**: Shows how many mappings use each channel
- **Multi-Column Layout**: Responsive grid display (1-3 columns based on screen size)

**Channel Sync**:
- Fetches all public and private channels from Slack
- Requires OAuth scopes: `channels:read`, `groups:read`
- Creates new channels or updates existing names
- Handles missing scope errors with detailed instructions

**UI Location**: `/admin/slack-channels`

**API Endpoints**:
- `GET /api/slack-channels` - List all channels
- `POST /api/slack-channels` - Create new channel
- `PUT /api/slack-channels/[id]` - Update channel
- `DELETE /api/slack-channels/[id]` - Delete channel
- `POST /api/slack-channels/sync` - Sync channels from Slack

---

### 5. HubSpot Company Management

**Purpose**: Manage HubSpot companies used in mappings.

**Features**:
- **Manual Entry**: Create companies manually with company ID and name
- **Bulk Sync**: Sync all companies from HubSpot account
- **Live Search**: Real-time filtering of companies
- **Usage Tracking**: Shows how many mappings use each company
- **Multi-Column Layout**: Responsive grid display (1-3 columns based on screen size)

**Company Sync**:
- Fetches all companies from HubSpot with pagination
- Handles large datasets with automatic pagination
- Creates new companies or updates existing names
- Handles rate limiting gracefully

**UI Location**: `/admin/hubspot-companies`

**API Endpoints**:
- `GET /api/hubspot-companies` - List all companies
- `POST /api/hubspot-companies` - Create new company
- `PUT /api/hubspot-companies/[id]` - Update company
- `DELETE /api/hubspot-companies/[id]` - Delete company
- `POST /api/hubspot-companies/sync` - Sync companies from HubSpot

---

### 6. ChatGPT Prompt Management

**Purpose**: Manage AI prompts used for generating Slack summaries.

**Features**:
- **Multiple Prompts**: Create and store multiple prompt templates
- **Active Prompt Selection**: Only one prompt can be active at a time
- **Prompt Activation**: Easy activation/deactivation of prompts
- **Default Fallback**: System uses a default prompt if no active prompt exists

**Prompt Usage**:
- Active prompt is used for all summary generation
- Prompts can include channel name and message context
- Supports custom instructions for summary style and format

**UI Location**: `/admin/prompts`

**API Endpoints**:
- `GET /api/prompts` - List all prompts
- `POST /api/prompts` - Create new prompt
- `PUT /api/prompts/[id]` - Update prompt
- `DELETE /api/prompts/[id]` - Delete prompt
- `POST /api/prompts/[id]/activate` - Activate a prompt (deactivates others)

---

### 7. Cron Job Execution & Logging

**Purpose**: Automated scheduled syncing with comprehensive logging.

**Features**:
- **Scheduled Execution**: Runs nightly at 11pm EST (4am UTC) via Vercel Cron
- **Cadence Filtering**: Only processes mappings matching the current day's cadence
- **Detailed Logging**: Tracks every cron run and mapping execution
- **Error Tracking**: Records failures with error messages
- **Statistics**: Tracks mappings found, executed, and failed

**Cron Log Information**:
- Start and completion timestamps
- Status (running, completed, failed)
- Active cadences for the run
- Day of week, day of month, last day of month
- Mapping execution statistics
- Error messages if failures occur

**Cron Log Mapping Details**:
- Individual mapping execution status
- Success/failure/skipped status
- Error messages for failed mappings
- Links to related mapping and company information

**UI Location**: `/admin/cron-logs`

**API Endpoints**:
- `GET /api/cron-logs` - List cron logs with pagination
  - Query parameters: `limit` (default: 50), `offset` (default: 0)

**Cron Configuration**:
- Configured in `vercel.json`
- Schedule: `0 4 * * *` (4am UTC daily)
- Protected by authentication check

---

## User Interface Features

### Authentication

**Login System**:
- Credentials-based authentication via NextAuth.js
- Admin-only access enforcement
- Session management
- Secure password hashing with bcrypt

**UI Location**: `/auth/signin`

### Navigation

**Header Component**:
- "Slacky Hub" branding
- Navigation links to all admin pages
- User menu with name, email, and logout
- User circle with first name initial
- Fixed position at top of all pages

### Responsive Design

**Layout Features**:
- Standardized page widths (`max-w-7xl mx-auto`)
- Full-width headers
- Responsive grid layouts for lists
- Mobile-friendly single-column layouts
- Desktop multi-column layouts (2-3 columns)

**Form Layouts**:
- Left column: 30% width (forms)
- Right column: 70% width (lists)
- Sticky form positioning
- Compact card styling

### Search & Filtering

**Live Search**:
- Real-time filtering as you type
- Available on Channels, Companies, and Users pages
- Case-insensitive search
- Searches across multiple fields
- Empty state messaging

**Search Fields**:
- **Channels**: Name and Channel ID
- **Companies**: Name and Company ID
- **Users**: First name, last name, email, Slack ID, full name

### Data Display

**Card Layouts**:
- Compact styling with reduced padding
- Multi-column responsive grids
- Hover effects for action buttons
- Status badges and indicators
- Usage counts and metadata

**Action Buttons**:
- Edit and Delete buttons (visible on hover)
- Fixed-position sync buttons
- Manual sync triggers
- Test sync functionality

---

## Technical Architecture

### Database Schema

**Models**:
- `User`: Application users with admin flags
- `SlackChannel`: Slack channel references
- `HubspotCompany`: HubSpot company references
- `Mapping`: Relationships between channels and companies
- `MappingSlackChannel`: Pivot table for many-to-many relationships
- `Prompt`: ChatGPT prompt templates
- `CronLog`: Scheduled sync execution logs
- `CronLogMapping`: Individual mapping execution records

### Service Layer

**Services**:
- `slackService.ts`: Slack API interactions
- `hubspotService.ts`: HubSpot API interactions
- `openaiService.ts`: OpenAI API interactions
- `userMappingService.ts`: User ID to name mapping
- `cadenceService.ts`: Cadence filtering logic
- `cronLogService.ts`: Cron log database operations
- `mappingService.ts`: Mapping query building
- `mappingSyncService.ts`: Core sync processing logic

### Middleware & Utilities

**Middleware**:
- `auth.ts`: Authentication requirement checking
- `errorHandler.ts`: Centralized error handling
- `methodValidator.ts`: HTTP method validation

**Utilities**:
- `password.ts`: Password hashing and generation
- `env.ts`: Environment variable validation
- `constants.ts`: Application constants

### API Architecture

**RESTful Endpoints**:
- Standard CRUD operations for all resources
- Consistent error handling
- Authentication on all routes
- Method validation
- Detailed error messages

**Error Handling**:
- Prisma error handling (unique constraints, not found)
- API rate limit detection and messaging
- Missing scope error handling (Slack)
- Detailed error responses with context

---

## Automation & Scheduling

### Scheduled Sync

**Vercel Cron Job**:
- Runs daily at 4am UTC (11pm EST)
- Automatically filters mappings by cadence
- Processes all eligible mappings
- Creates comprehensive logs

**Cadence Logic**:
- **Daily**: Monday-Friday only
- **Weekly**: Fridays only
- **Monthly**: Last day of month only

**Processing**:
- 2-second delay between mappings to prevent rate limiting
- Individual error handling per mapping
- Continues processing even if one mapping fails
- Detailed logging of all operations

---

## Security Features

### Authentication
- Admin-only login enforcement
- Secure password hashing (bcrypt, 12 rounds)
- Session management via NextAuth.js
- Protected API routes

### Data Protection
- Environment variable validation
- Secure token storage
- Input validation
- SQL injection protection (Prisma ORM)

### Error Handling
- No sensitive data in error messages
- Detailed logging for debugging
- User-friendly error messages
- Rate limit protection

---

## Integration Points

### Slack Integration
- **OAuth Scopes Required**:
  - `channels:read` - Read public channels
  - `groups:read` - Read private channels
  - `chat:write` - Create messages (for auto-join)
  - `users:read` - Read user information
- **API Features**:
  - Channel listing
  - Message history fetching
  - User information retrieval
  - Auto-join functionality

### HubSpot Integration
- **API Features**:
  - Company listing with pagination
  - Note creation
  - Company-to-note associations
- **Authentication**: Private App Access Token

### OpenAI Integration
- **Model**: GPT-3.5-turbo
- **Features**:
  - Custom prompt support
  - Fallback summary generation
  - Rate limit handling
- **Authentication**: API Key

---

## Testing

### Test Coverage
- Unit tests for services
- API route tests
- Component tests
- Integration tests
- Test coverage tracking

### Test Suite
- Jest testing framework
- React Testing Library
- Mock implementations for external APIs
- CI/CD integration
- Automated test runs on deployment

---

## Deployment

### Vercel Deployment
- Automatic builds on git push
- Environment variable configuration
- Cron job configuration
- Prisma client generation
- Test execution before deployment

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SLACK_BOT_TOKEN`: Slack Bot User OAuth Token
- `HUBSPOT_ACCESS_TOKEN`: HubSpot Private App Access Token
- `OPENAI_API_KEY`: OpenAI API Key
- `NEXTAUTH_SECRET`: NextAuth.js secret
- `NEXTAUTH_URL`: Application URL

---

## Key Workflows

### Creating a Mapping
1. Navigate to Home page
2. Select one or more Slack channels
3. Select a HubSpot company
4. Optionally add a title
5. Set cadence (Daily/Weekly/Monthly)
6. Submit form
7. Mapping is created and ready for syncing

### Manual Sync
1. Navigate to Home page
2. Click "Sync Now" on a mapping
3. System fetches messages, generates summary, creates HubSpot note
4. Results displayed in UI

### Scheduled Sync
1. Cron job triggers at scheduled time
2. System filters mappings by cadence
3. Processes each eligible mapping
4. Creates cron log entry
5. Logs all operations
6. Updates mapping status

### User Sync from Slack
1. Navigate to Users page
2. Click "Sync from Slack" button
3. System fetches all Slack users
4. Creates or updates local users
5. Generates temporary passwords for new users
6. Displays sync results

---

## Data Flow

### Sync Process Flow
```
1. Trigger (Manual or Cron)
   ↓
2. Filter Mappings by Cadence
   ↓
3. For Each Mapping:
   a. Fetch Slack Messages
   b. Replace User IDs with Names
   c. Format Messages
   d. Generate AI Summary
   e. Create HubSpot Note
   f. Log Results
   ↓
4. Update Cron Log
   ↓
5. Return Results
```

### User ID Replacement Flow
```
1. Fetch Messages from Slack
   ↓
2. Extract User IDs from Messages
   ↓
3. Query Local User Database
   ↓
4. Replace IDs with "FirstName LastName"
   ↓
5. Pass to AI for Summary Generation
```

---

## Error Handling

### API Error Types
- **Rate Limiting**: Automatic retry messaging, delays between operations
- **Missing Scopes**: Detailed instructions for adding OAuth scopes
- **Not Found**: User-friendly error messages
- **Validation Errors**: Field-specific error messages
- **Database Errors**: Unique constraint handling, cascade deletion

### Error Recovery
- Individual mapping failures don't stop batch processing
- Detailed error logging for debugging
- User-friendly error messages in UI
- Retry mechanisms for rate-limited operations

---

## Performance Optimizations

### Rate Limiting Protection
- 2-second delays between mapping processing
- Configurable test delays
- Rate limit detection and messaging
- Graceful degradation

### Database Optimization
- Indexed fields for common queries
- Efficient relationship queries
- Pagination for large datasets
- Cascade deletion for data integrity

### UI Optimization
- Responsive grid layouts
- Lazy loading where applicable
- Efficient state management
- Optimized re-renders

---

## Future Enhancements (Potential)

Based on the codebase structure, potential enhancements could include:
- Webhook support for real-time syncing
- Email notifications for sync failures
- Advanced filtering and search
- Bulk operations
- Export/import functionality
- Analytics and reporting
- Custom field mapping
- Multi-workspace support

---

## Summary

Slacky Hub is a comprehensive automation platform that bridges Slack and HubSpot, providing:
- **Automated syncing** of Slack conversations to HubSpot notes
- **AI-powered summaries** using customizable prompts
- **Flexible mapping** between multiple channels and companies
- **Scheduled execution** based on configurable cadences
- **Comprehensive logging** for audit and debugging
- **User-friendly admin interface** for all operations
- **Robust error handling** and rate limit protection
- **Secure authentication** with admin-only access

The application is production-ready with comprehensive testing, error handling, and logging capabilities.



