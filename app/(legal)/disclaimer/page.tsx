import Link from 'next/link'

export const metadata = {
  title: 'Disclaimer - Polnation',
  description: 'Important risk disclosures and disclaimers for the Polnation platform',
}

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/" className="text-emerald-600 hover:text-emerald-700 mb-8 inline-block">
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-zinc-900 mb-4">Disclaimer</h1>
        <p className="text-zinc-600 mb-10">
          <strong>Last updated:</strong> April 9, 2026
        </p>

        <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-800 font-semibold text-sm uppercase tracking-wide mb-2">Important Notice</p>
          <p className="text-amber-900 text-sm leading-relaxed">
            Please read this Disclaimer carefully before using the Polnation platform. By accessing or using our services, you acknowledge that you have read, understood, and agree to be bound by the terms set forth below.
          </p>
        </div>

        <div className="prose prose-zinc max-w-none space-y-8">

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">1. Not Financial Advice</h2>
            <p className="text-zinc-700 mb-4">
              Nothing on the Polnation platform constitutes financial, investment, legal, or tax advice. All content, features, reward rates, and yield figures displayed on the platform are for informational and illustrative purposes only. You should not rely on any information provided by Polnation as a substitute for professional financial or investment advice.
            </p>
            <p className="text-zinc-700">
              Before making any investment or financial decision, you are strongly encouraged to consult with a qualified financial adviser, attorney, accountant, or other professional adviser familiar with your specific circumstances.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">2. No Guarantee of Returns</h2>
            <p className="text-zinc-700 mb-4">
              Any yield rates, reward percentages, APY figures, or earnings projections displayed on Polnation are estimates based on current platform parameters and are subject to change at any time without notice. Past performance is not indicative of future results.
            </p>
            <p className="text-zinc-700">
              Polnation makes no representation, warranty, or guarantee — express or implied — that you will achieve any particular return on your assets, or that you will not incur losses. The actual rewards you receive may be significantly lower than projected, or you may receive no rewards at all.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">3. Risk of Loss</h2>
            <p className="text-zinc-700 mb-4">
              Participating in Web3 platforms involves substantial risk of loss. You should only participate with funds you can afford to lose entirely. Risks include but are not limited to:
            </p>
            <ul className="list-disc pl-6 text-zinc-700 space-y-2">
              <li><strong>Market risk:</strong> The value of digital assets, including USDC and other stablecoins, can fluctuate significantly due to market conditions, regulatory actions, or loss of peg.</li>
              <li><strong>Smart contract risk:</strong> Smart contracts may contain bugs, vulnerabilities, or exploits that could result in the partial or total loss of funds.</li>
              <li><strong>Liquidity risk:</strong> There is no guarantee that you will be able to withdraw your funds at any given time. Platform liquidity may be insufficient to process withdrawals.</li>
              <li><strong>Counterparty risk:</strong> The platform's ability to pay rewards depends on the continued operation and solvency of Polnation and its associated entities.</li>
              <li><strong>Regulatory risk:</strong> Changes in laws, regulations, or government policies in any jurisdiction may adversely affect the platform and your ability to access funds.</li>
              <li><strong>Technology risk:</strong> System failures, cyberattacks, or network outages could result in inability to access the platform or loss of funds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">4. Not a Licensed Financial Institution</h2>
            <p className="text-zinc-700 mb-4">
              Polnation is not a bank, broker-dealer, investment adviser, exchange, or any other type of licensed financial institution. We are not regulated by any financial regulatory authority. Our platform does not offer deposit insurance, government-backed protections, or any guarantees that exist in traditional regulated financial systems.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">5. Jurisdictional Restrictions</h2>
            <p className="text-zinc-700 mb-4">
              The services offered by Polnation may not be available or appropriate for use in all jurisdictions. It is your sole responsibility to determine whether your participation in the platform is lawful in your jurisdiction. Polnation expressly disclaims all liability for your use of the platform in any jurisdiction where such use is prohibited or restricted.
            </p>
            <p className="text-zinc-700">
              Users from the United States, Canada, China, and other jurisdictions where digital asset yield products are regulated or prohibited should exercise particular caution and seek independent legal advice before participating.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">6. Referral Program Disclaimer</h2>
            <p className="text-zinc-700 mb-4">
              Polnation operates a referral reward program. Participation in the referral program does not constitute an investment contract, securities offering, or any regulated financial instrument. Referral rewards are distributed solely at the discretion of Polnation and may be modified, suspended, or terminated at any time.
            </p>
            <p className="text-zinc-700">
              Recruiting others to join the platform does not guarantee any income and should not be represented as such to potential participants.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">7. Third-Party Services</h2>
            <p className="text-zinc-700">
              Polnation integrates with third-party services including blockchain networks, wallet providers, and data providers (such as Polygon, WalletConnect, and others). We are not responsible for the actions, omissions, errors, or failures of any third-party service. Your use of third-party services is governed by their respective terms and conditions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">8. Limitation of Liability</h2>
            <p className="text-zinc-700 mb-4">
              To the maximum extent permitted by applicable law, Polnation and its affiliates, officers, employees, agents, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages — including but not limited to loss of profits, loss of data, or loss of digital assets — arising out of or in connection with your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">9. Forward-Looking Statements</h2>
            <p className="text-zinc-700">
              This platform may contain forward-looking statements regarding future platform features, reward structures, or performance. Such statements are based on current expectations and assumptions and are subject to significant risks and uncertainties. Actual results may differ materially from those described in any forward-looking statements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">10. Changes to This Disclaimer</h2>
            <p className="text-zinc-700">
              Polnation reserves the right to update or modify this Disclaimer at any time. Changes will be effective immediately upon posting to the platform. Your continued use of the platform following any changes constitutes your acceptance of the revised Disclaimer.
            </p>
          </section>

          <section className="mt-10 p-5 bg-zinc-100 rounded-xl">
            <p className="text-zinc-600 text-sm">
              If you have any questions about this Disclaimer, please contact us before using the platform. By continuing to use Polnation, you confirm that you have read and understood the risks described above.
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <Link href="/terms" className="text-emerald-600 hover:text-emerald-700">Terms of Service</Link>
              <Link href="/privacy" className="text-emerald-600 hover:text-emerald-700">Privacy Policy</Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
