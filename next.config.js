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
}

module.exports = nextConfig

