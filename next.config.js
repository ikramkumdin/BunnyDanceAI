/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['tempfile.aiquickdraw.com', 's3.amazonaws.com'],
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



