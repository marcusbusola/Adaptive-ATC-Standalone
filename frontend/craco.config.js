/**
 * CRACO Configuration
 * Override Create React App webpack config to disable TypeScript checker
 * and ESLint plugin to avoid dependency conflicts
 */

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Remove problematic plugins that cause dependency issues
      webpackConfig.plugins = webpackConfig.plugins.filter(
        plugin => {
          const name = plugin.constructor.name;
          return name !== 'ForkTsCheckerWebpackPlugin' &&
                 name !== 'ESLintWebpackPlugin';
        }
      );

      return webpackConfig;
    }
  },
  eslint: {
    enable: false
  }
};
