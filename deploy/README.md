# Deployment notes

## CORS on the menu bucket (required)

The menu pages run in the browser and fetch the tenant JSON directly from

```
https://s3-akut-prod-01.s3.eu-west-1.amazonaws.com/products/menu/active/<tenant>.json
```

Because that request is cross-origin (the site is served from a different host
than the S3 bucket), the bucket **must** return CORS headers or the browser will
block the response and every menu will show the friendly "temporarily
unavailable" screen.

At the time of writing the bucket returns no `Access-Control-Allow-Origin`
header. Apply the policy in [`s3-cors.json`](./s3-cors.json):

```bash
aws s3api put-bucket-cors \
  --bucket s3-akut-prod-01 \
  --cors-configuration file://deploy/s3-cors.json
```

`AllowedOrigins` is `*` here because the objects are already public and contain
no secrets. Tighten it to the real site origin(s) once the hosting domain is
known. This config ideally lives in the **akut.infra.iac** repository alongside
the rest of the bucket definition.

Verify:

```bash
curl -s -D - -o /dev/null \
  -H "Origin: https://your-site-origin" \
  https://s3-akut-prod-01.s3.eu-west-1.amazonaws.com/products/menu/active/test.json \
  | grep -i access-control
```

## Hosting

The site is fully static (`_site/` after `jekyll build`). Any static host works.
For clean tenant URLs like `/test`:

- **S3 website hosting / GitHub Pages**: serve `404.html` for unknown paths
  (both already do). `404.html` is wired as the dispatcher, so `/test` resolves
  the tenant and loads its menu.
- **SPA-style hosts (Netlify, CloudFront + Lambda@Edge, nginx)**: rewrite
  unknown paths to `/index.html` (also the dispatcher).
- The `?tenant=<tenant>` query form works on every host with no rewrite rules.

Set `baseurl` in `_config.yml` if the site is hosted under a sub-path.
