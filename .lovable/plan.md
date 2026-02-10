
## Fix PWA Caching for Immediate Updates

### Problem
The current PWA configuration aggressively caches all assets and API responses, preventing users from seeing published changes without manually clearing their cache.

### Changes to `vite.config.ts`

1. **Add `skipWaiting: true`** -- Forces the new service worker to activate immediately instead of waiting for all tabs to close.

2. **Add `clientsClaim: true`** -- Makes the new service worker take control of all open pages right away.

3. **Reduce Supabase cache duration** from 24 hours to 5 minutes (`maxAgeSeconds: 300`), and reduce `maxEntries` from 100 to 50.

4. **Add `navigateFallback` and `cleanupOutdatedCaches: true`** to ensure old caches are removed on update.

5. **Narrow `globPatterns`** to only essential static assets (`*.{js,css,html,ico,png,svg}`), removing `woff2` to reduce unnecessary caching.

### Technical Details

The key Workbox options being added/changed:

```text
workbox: {
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
  runtimeCaching: [
    {
      urlPattern: supabase pattern,
      handler: "NetworkFirst",
      options: {
        cacheName: "supabase-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300,  // 5 minutes instead of 24 hours
        },
      },
    },
  ],
}
```

This is a single-file change that will ensure all users get the latest version on their next page load/refresh.
