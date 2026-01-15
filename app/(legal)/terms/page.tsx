import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - Polnation',
  description: 'Terms of Service for Polnation platform',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/" className="text-emerald-600 hover:text-emerald-700 mb-8 inline-block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-zinc-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-zinc max-w-none">
          <p className="text-zinc-600 mb-6">
            <strong>Last updated:</strong> January 15, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-zinc-700 mb-4">
              By accessing or using the Polnation platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. Description of Service</h2>
            <p className="text-zinc-700 mb-4">
              Polnation is a soft staking demonstration platform that allows users to:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Create and manage a user profile</li>
              <li>Build a referral network</li>
              <li>Connect cryptocurrency wallets</li>
              <li>Participate in soft staking programs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. User Accounts</h2>
            <p className="text-zinc-700 mb-4">To use certain features of our Service, you must:</p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Register for an account with accurate information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be at least 18 years old or the age of majority in your jurisdiction</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Wallet Connection</h2>
            <p className="text-zinc-700 mb-4">
              When you connect your cryptocurrency wallet to our Service:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>You retain full control of your wallet and private keys</li>
              <li>We only read publicly available blockchain data</li>
              <li>We do not have the ability to access or transfer your funds</li>
              <li>You are responsible for the security of your wallet</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Soft Staking</h2>
            <p className="text-zinc-700 mb-4">
              Our soft staking feature:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Does not require you to transfer funds to any smart contract</li>
              <li>Takes periodic snapshots of wallet balances</li>
              <li>Rewards are calculated based on snapshot data</li>
              <li>Is for demonstration purposes only</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Referral Program</h2>
            <p className="text-zinc-700 mb-4">
              By participating in our referral program, you agree to:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Only invite people you know personally</li>
              <li>Not engage in spam or unsolicited marketing</li>
              <li>Not misrepresent the Service or potential rewards</li>
              <li>Accept that referral relationships cannot be changed once established</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">7. Prohibited Activities</h2>
            <p className="text-zinc-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-zinc-700 mb-4">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Create multiple accounts or use false information</li>
              <li>Engage in any activity that could harm other users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">8. Disclaimer of Warranties</h2>
            <p className="text-zinc-700 mb-4">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-zinc-700 mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, POLNATION SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">10. Modifications</h2>
            <p className="text-zinc-700 mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms on our website. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">11. Contact Us</h2>
            <p className="text-zinc-700 mb-4">
              If you have questions about these Terms, please contact us at:
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
