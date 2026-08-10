# WebScope Agent Evidence Bundle

This bundle is evidence collected from one supplied URL. WebScope is an informer, not a scraper.

## Recommended agent workflow
1. Read `manifest.json` and `report.json`.
2. Read `variables/index.json`, then open the individual variable files that matter.
3. Read `network/api_endpoints.json` to find likely data sources.
4. Read `api_responses/index.json`, then inspect individual `meta.json` and `body.json`/`body.bin` files.
5. Prefer an observed API response that contains the requested data over brittle DOM selectors.
6. Use request method, URL, query string, request body and response shape from the evidence when implementing the scraper.
7. Treat every response as separate evidence; do not assume two endpoints are interchangeable.
8. If a response body is missing, use its metadata and look for another observed response.
9. Never assume a discovered URL was crawled: only the supplied page was loaded.

## Bundle counts
- Variables: 1
- API responses with bodies: 21
- Requests: 302
- Responses: 302

## Important
Sensitive authentication/cookie headers are redacted. This bundle describes what the page exposed during observation; it does not contain credentials.
