export const nextConfigWebpackTemplate = `
webpack: (config) => {
  // Add alias for @tx3
  config.resolve.alias = {
    ...config.resolve.alias,
    '@tx3': './node_modules/.tx3',
  };

  // Configure webpack to handle TypeScript files in .tx3 directory
  config.module.rules.push({
    test: /\\.ts$/,
    include: /node_modules\\/\\.tx3/,
    use: [
      {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          compilerOptions: {
            module: 'esnext',
            target: 'es2017',
            moduleResolution: 'node',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
          },
        },
      },
    ],
  });

  return config;
},`;

export function generateNextConfig(existingConfig?: string): string {
  if (!existingConfig) {
    // Create a new Next.js config
    return `/** @type {import('next').NextConfig} */
const nextConfig = {
  ${nextConfigWebpackTemplate}
};

export default nextConfig;
`;
  }

  // If config already exists, we need to merge the webpack configuration
  // This is a simplified approach - in a production tool, you'd want more sophisticated AST parsing
  if (existingConfig.includes('webpack:')) {
    // Webpack config already exists - warn user to manually merge
    throw new Error('Existing webpack configuration detected. Please manually merge the TX3 webpack configuration.');
  } else {
    // Add webpack config to existing config
    const lines = existingConfig.split('\n');
    const configObjectStart = lines.findIndex(line => line.includes('const nextConfig') || line.includes('module.exports'));
    
    if (configObjectStart === -1) {
      throw new Error('Could not parse existing Next.js configuration');
    }

    // Find the closing brace of the config object
    let insertIndex = -1;
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = configObjectStart; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('{')) {
        foundOpenBrace = true;
        braceCount += (line.match(/{/g) || []).length;
      }
      
      if (foundOpenBrace) {
        braceCount -= (line.match(/}/g) || []).length;
        
        if (braceCount === 0) {
          insertIndex = i;
          break;
        }
      }
    }

    if (insertIndex === -1) {
      throw new Error('Could not find insertion point in Next.js configuration');
    }

    // Insert the webpack configuration before the closing brace
    const webpackConfig = nextConfigWebpackTemplate.split('\n').map(line => '  ' + line);
    lines.splice(insertIndex, 0, ...webpackConfig);

    return lines.join('\n');
  }
}