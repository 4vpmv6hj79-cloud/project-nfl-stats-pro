/**
 * Proxy config para desarrollo local.
 * Rutea las peticiones /api/* al origen correcto de ESPN
 * basándose en el query param 'origin'.
 */
module.exports = {
  '/api': {
    target: 'https://site.api.espn.com',
    secure: true,
    changeOrigin: true,
    router: function(req) {
      const url = new URL(req.url, 'http://localhost');
      const origin = url.searchParams.get('origin');

      if (origin === 'site-web') {
        return 'https://site.web.api.espn.com';
      }
      if (origin === 'core') {
        return 'https://sports.core.api.espn.com';
      }

      return 'https://site.api.espn.com';
    },
    pathRewrite: function(path) {
      // Remove /api prefix and the origin param
      let newPath = path.replace(/^\/api/, '');
      // Remove origin param from query string
      newPath = newPath.replace(/([?&])origin=[^&]*(&|$)/, function(match, pre, post) {
        return post ? pre : '';
      });
      return newPath;
    },
  },
};
