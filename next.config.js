/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tempfile.aiquickdraw.com',
        pathname: '/s/**',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      // Add any other domains where images might be hosted
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

module.exports = nextConfig;



