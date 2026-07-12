export const metadata = { title: "Terms of Service — BuckGrid Pro" };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#e8e8e8" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ opacity: 0.7, marginBottom: 32 }}>BuckGrid Pro · Last updated July 12, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>The service</h2>
      <p>BuckGrid Pro is a hunting land-analysis application operated by Bo Bell, an independent developer in Kansas, USA. By using the app you agree to these terms.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Acceptable use</h2>
      <p>Use the app for lawful hunting and land-management purposes only. Don't attempt to break, reverse-engineer, or overload the service. Analysis results are advisory — always follow local hunting laws and regulations.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Your content</h2>
      <p>Property boundaries and photos you upload remain yours. We use them only to provide the app's features, as described in our <a href="/privacy" style={{ color: "#7fd8e8" }}>Privacy Policy</a>.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Content publishing tools</h2>
      <p>Our internal publishing software uses YouTube API Services to upload our own original videos to channels we own. Viewers of that content are subject to the <a href="https://www.youtube.com/t/terms" style={{ color: "#7fd8e8" }}>YouTube Terms of Service</a>.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>No warranty</h2>
      <p>The service is provided as-is, without warranties of any kind. We may modify or discontinue features at any time.</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Contact</h2>
      <p>Questions: buckgridpro@gmail.com</p>
    </main>
  );
}
