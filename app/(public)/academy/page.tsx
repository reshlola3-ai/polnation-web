import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from '@/i18n/config'
import { createServerClient } from '@/lib/supabase-server'
import Image from 'next/image'
import Link from 'next/link'
import { AcademyContent } from './AcademyContent'

export const metadata = {
  title: 'Academy - Complete Guide | Polnation',
  description: 'Complete guide to start earning passive income with Polnation. Step-by-step tutorial for crypto beginners.',
}

export default async function AcademyPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value as Locale | undefined
  const locale = localeCookie && locales.includes(localeCookie) ? localeCookie : defaultLocale

  const t = await getTranslations('academy')

  // Build translations object for client component
  const translations = {
    title: t('title'),
    subtitle: t('subtitle'),
    backToHome: t('backToHome'),
    videoTutorial: t('videoTutorial'),
    videoComingSoon: t('videoComingSoon'),
    videoComingSoonDesc: t('videoComingSoonDesc'),
    step: t('step'),
    bonus: t('bonus'),
    readyToStart: t('readyToStart'),
    readyToStartDesc: t('readyToStartDesc'),
    getStartedNow: t('getStartedNow'),
    tableOfContents: t('tableOfContents'),
    introduction: t('introduction'),
    introText: t('introText'),
    steps: {
      wallet: {
        title: t('steps.wallet.title'),
        intro: t('steps.wallet.intro'),
        recommended: t('steps.wallet.recommended'),
        alternative: t('steps.wallet.alternative'),
        download: t('steps.wallet.download'),
        setupTitle: t('steps.wallet.setupTitle'),
        setupSteps: t.raw('steps.wallet.setupSteps') as string[],
        warning: t('steps.wallet.warning'),
      },
      deposit: {
        title: t('steps.deposit.title'),
        intro: t('steps.deposit.intro'),
        methodExchange: t('steps.deposit.methodExchange'),
        exchangeSteps: t.raw('steps.deposit.exchangeSteps') as string[],
        methodSwap: t('steps.deposit.methodSwap'),
        swapSteps: t.raw('steps.deposit.swapSteps') as string[],
        networkNote: t('steps.deposit.networkNote'),
        networkNoteDesc: t('steps.deposit.networkNoteDesc'),
      },
      sign: {
        title: t('steps.sign.title'),
        intro: t('steps.sign.intro'),
        signSteps: t.raw('steps.sign.signSteps') as string[],
        whatIsTitle: t('steps.sign.whatIsTitle'),
        whatIsPoints: t.raw('steps.sign.whatIsPoints') as string[],
      },
      earn: {
        title: t('steps.earn.title'),
        intro: t('steps.earn.intro'),
        features: t.raw('steps.earn.features') as Array<{ title: string; desc: string }>,
        tiersTitle: t('steps.earn.tiersTitle'),
      },
      team: {
        title: t('steps.team.title'),
        intro: t('steps.team.intro'),
        benefits: t.raw('steps.team.benefits') as string[],
      },
    },
  }

  return <AcademyContent translations={translations} user={user} locale={locale} />
}
