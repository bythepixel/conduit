# CORS Configuration

This application includes CORS (Cross-Origin Resource Sharing) configuration to control which origins can access the API endpoints.

## Configuration

CORS is configured in two places:

1. **Next.js Headers** (`next.config.js`) - Sets default CORS headers for all API routes
2. **CORS Middleware** (`lib/middleware/cors.ts`) - Provides runtime origin validation and OPTIONS request handling

## Environment Variables

Configure allowed origins using environment variables:

### `ALLOWED_ORIGINS` (Recommended)
Comma-separated list of allowed origins:
```bash
ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

### `NEXT_PUBLIC_APP_URL` (Fallback)
Single origin URL:
```bash
NEXT_PUBLIC_APP_URL=https://app.example.com
```

## Behavior

### Development Mode
- If no origins are configured, **all origins are allowed** (including localhost)
- Localhost origins (`http://localhost:3000`, `http://127.0.0.1:3000`) are automatically allowed

### Production Mode
- **Origins must be explicitly configured** via `ALLOWED_ORIGINS` or `NEXT_PUBLIC_APP_URL`
- Requests from origins not in the allowed list will be rejected with a 403 status
- Same-origin requests (no `Origin` header) are always allowed

## Usage in API Routes

The CORS middleware is automatically applied via Next.js headers configuration. For additional control, you can use the middleware directly:

```typescript
import { corsMiddleware } from '../../../lib/middleware/cors'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Handle CORS (returns true if handled, false to continue)
    if (corsMiddleware(req, res)) {
        return // CORS handled (OPTIONS request or origin blocked)
    }

    // Your route logic here...
}
```

## CORS Headers Set

The following headers are set on all API responses:

- `Access-Control-Allow-Credentials: true` - Allows cookies/credentials
- `Access-Control-Allow-Origin: <origin>` - The allowed origin (or `*` in dev)
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-hub-signature`
- `Access-Control-Max-Age: 86400` - Cache preflight for 24 hours

## Security Considerations

1. **Never use `*` in production** - Always specify exact origins
2. **Use HTTPS** - Only allow HTTPS origins in production
3. **Limit origins** - Only include origins that actually need API access
4. **Webhooks** - The `/api/firespot` endpoint has CORS enabled for webhook sources

## Testing

Run the CORS tests:
```bash
npm test -- __tests__/lib/middleware/cors.test.ts
```

## Example Configuration

### Single Origin
```bash
ALLOWED_ORIGINS=https://app.example.com
```

### Multiple Origins
```bash
ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com,https://admin.example.com
```

### Vercel Deployment
Set in Vercel dashboard under Settings → Environment Variables:
```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

