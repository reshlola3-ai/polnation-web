import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - Polnation',
  description: 'Privacy Policy for Polnation platform',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/" className="text-emerald-600 hover:text-emerald-700 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-zinc-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-zinc max-w-none">
          <p className="text-zinc-600 mb-6">
            <strong>Last updated:</strong> January 15, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Introduction</h2>
            <p className="text-zinc-700 mb-4">
              Welcome to Polnation ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Information We Collect</h2>
            <p className="text-zinc-700 mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Account information (email address, username, password)</li>
              <li>Profile information (phone number, country, Telegram username)</li>
              <li>Wallet address (when you connect your cryptocurrency wallet)</li>
              <li>Referral information (your referrer and referrals)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-700 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Track and manage referral relationships</li>
              <li>Communicate with you about products, services, and events</li>
              <li>Monitor and analyze trends, usage, and activities</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Information Sharing</h2>
            <p className="text-zinc-700 mb-4">
              We may share your information in the following situations:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>With your referrer and referrals (limited profile information)</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With your consent or at your direction</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Blockchain Data</h2>
            <p className="text-zinc-700 mb-4">
              When you connect your wallet, we read your USDC balance on the Polygon network. This information is publicly available on the blockchain. We do not have access to your private keys or the ability to control your funds.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Data Security</h2>
            <p className="text-zinc-700 mb-4">
              We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">7. Your Rights</h2>
            <p className="text-zinc-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">8. Contact Us</h2>
            <p className="text-zinc-700 mb-4">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-zinc-700">
              Email: support@polnation.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
