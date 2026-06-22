/**
 * Sentry 可选监控模块
 * 在 Cloudflare Pages 环境变量中配置 SENTRY_DSN 和 SENTRY_ENV 后自动启用
 *
 * 用法: 在所有 HTML 页面的 <head> 中添加
 *   <script>window.SENTRY_DSN=window.SENTRY_DSN||'';window.SENTRY_ENV=window.SENTRY_ENV||'production';</script>
 *   <script src="/utils/sentry.js"></script>
 */
(function() {
  'use strict';
  if (window.__sentry_loaded) return;
  window.__sentry_loaded = true;

  var DSN = window.SENTRY_DSN || '';
  if (!DSN) return;

  var s = document.createElement('script');
  s.src = 'https://browser.sentry-cdn.com/7.120.3/bundle.tracing.replay.min.js';
  s.integrity = 'sha384-9IQykY5GYQUqfFeYDOodM2m8GWjY5xoTFJIqnSbgHx0YLmFjDId3F/e6q0Gz4Rt';
  s.crossOrigin = 'anonymous';
  s.onload = function() {
    if (window.Sentry) {
      window.Sentry.init({
        dsn: DSN,
        environment: window.SENTRY_ENV || 'production',
        tracesSampleRate: 0.3,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 0.5
      });
    }
  };
  document.head.appendChild(s);
})();
