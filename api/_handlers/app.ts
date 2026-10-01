// Android app (Trusted Web Activity) support.
//   GET /.well-known/assetlinks.json → proves to Android that the Play Store app and this website belong together,
//   so the app opens full-screen with no browser bar. Set ANDROID_PACKAGE and ANDROID_SHA256 (comma-separated
//   SHA-256 signing-certificate fingerprints: your upload key AND Google Play's app-signing key) in Vercel.
import { env, type Ctx, type Req, type Res } from '../_lib/util.js'

export default async function app(_req: Req, res: Res, action: string, _ctx: Ctx | null) {
  if (action === 'assetlinks') {
    const fingerprints = env('ANDROID_SHA256').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).json(fingerprints.length ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: env('ANDROID_PACKAGE') || 'com.omnitotalstack.app', sha256_cert_fingerprints: fingerprints } }] : [])
  }
  return res.status(404).json({ error: 'Not found' })
}
