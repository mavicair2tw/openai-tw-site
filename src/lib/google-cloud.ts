// Deprecated compatibility shim.
// Media persistence has moved to Cloudflare D1 + R2.
export {
  buildMediaObjectPath,
  buildPublicMediaUrl,
  normalizeEnvValue,
  isCloudflareConfigError as isGoogleCloudConfigError,
} from '@/lib/cloudflare';
