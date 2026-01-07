/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/firespot',
        destination: '/api/firespot',
      },
    ]
  },
  async headers() {
    // Get allowed origins from environment variable
    // Can be a single origin or comma-separated list
    const allowedOrigins = process.env.ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || '*'
    const origins = allowedOrigins.split(',').map(origin => origin.trim())
    
    // In development, allow localhost
    const isDevelopment = process.env.NODE_ENV === 'development'
    const developmentOrigins = ['http://localhost:3000', 'http://localhost:3006', 'http://127.0.0.1:3000']
    
    // Combine production and development origins
    const allOrigins = isDevelopment 
      ? [...origins, ...developmentOrigins].filter(Boolean)
      : origins
    
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            // If only one origin, use it directly; otherwise, we'll handle dynamically
            value: allOrigins.length === 1 ? allOrigins[0] : allOrigins[0] || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, x-hub-signature',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig





