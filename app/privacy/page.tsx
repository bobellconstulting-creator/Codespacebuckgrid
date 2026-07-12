export const metadata = { title: "Privacy Policy — BuckGrid Pro" };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#e8e8e8", background: "transparent" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ opacity: 0.7, marginBottom: 32 }}>BuckGrid Pro · Last updated July 12, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Who we are</h2>
      <p>BuckGrid Pro is a hunting land-analysis application built and operated by Bo Bell, an independent developer in Kansas, USA. Contact: buckgridpro@gmail.com.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>What we collect</h2>
      <p>When you use the BuckGrid Pro app: your account email, the property boundaries you draw, and any trail-camera photos you choose to upload. We use this data only to provide the app's analysis features. We do not sell or share your data with third parties.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Content publishing tools</h2>
      <p>We operate internal software that publishes our own original marketing videos to our own social media channels (YouTube, Instagram, Facebook, TikTok). These tools use YouTube API Services. They upload content only to channels we own; they do not access, collect, or store any data about other users or viewers.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>YouTube API Services</h2>
      <p>Our software uses YouTube API Services. By interacting with our YouTube content you are also subject to the <a href="https://www.youtube.com/t/terms" style={{ color: "#7fd8e8" }}>YouTube Terms of Service</a> and the <a href="https://policies.google.com/privacy" style={{ color: "#7fd8e8" }}>Google Privacy Policy</a>. Our API client does not access, collect, or store any YouTube user data from third parties; it only uploads and reads analytics for videos on our own channel. It stores no Authorized Data beyond OAuth tokens for our own account, which we keep encrypted on our own hardware and which you can revoke at any time via <a href="https://security.google.com/settings/security/permissions" style={{ color: "#7fd8e8" }}>Google security settings</a>.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Data retention & deletion</h2>
      <p>You can request deletion of your BuckGrid Pro account data at any time by emailing buckgridpro@gmail.com. We delete it within 30 days.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Changes</h2>
      <p>If this policy changes, the new version will be posted at this URL with an updated date.</p>
    </main>
  );
}
