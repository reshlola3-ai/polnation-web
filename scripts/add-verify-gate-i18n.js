// Injects i18n keys for the new VerifyAccountGate component.
// Run: node scripts/add-verify-gate-i18n.js

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '../messages')

const KEYS = {
  en: {
    telegramTitle: 'Connect Telegram',
    telegramSubtitle: 'One account per Telegram — prevents duplicates',
    telegramDescription: 'To access tasks, link your Telegram account. Each Telegram can only be linked to one Polnation account.',
    telegramAlreadyBound: 'This Telegram account is already linked to another account.',
    telegramGenericError: 'Failed to bind Telegram. Please try again.',
    recommended: 'Recommended',
    orDivider: 'or',
  },
  zh: {
    telegramTitle: '连接 Telegram',
    telegramSubtitle: '每个 Telegram 仅限绑定一个账号',
    telegramDescription: '要进入任务页面，请绑定您的 Telegram。每个 Telegram 账号只能绑定一个 Polnation 账号。',
    telegramAlreadyBound: '此 Telegram 账号已绑定到其他账号。',
    telegramGenericError: '绑定 Telegram 失败，请重试。',
    recommended: '推荐',
    orDivider: '或',
  },
  fr: {
    telegramTitle: 'Connecter Telegram',
    telegramSubtitle: 'Un compte par Telegram — empêche les doublons',
    telegramDescription: 'Pour accéder aux tâches, liez votre compte Telegram. Chaque Telegram ne peut être lié qu\'à un seul compte Polnation.',
    telegramAlreadyBound: 'Ce compte Telegram est déjà lié à un autre compte.',
    telegramGenericError: 'Échec de la liaison Telegram. Veuillez réessayer.',
    recommended: 'Recommandé',
    orDivider: 'ou',
  },
  id: {
    telegramTitle: 'Hubungkan Telegram',
    telegramSubtitle: 'Satu akun per Telegram — mencegah duplikat',
    telegramDescription: 'Untuk mengakses tugas, hubungkan akun Telegram Anda. Setiap Telegram hanya dapat dihubungkan ke satu akun Polnation.',
    telegramAlreadyBound: 'Akun Telegram ini sudah terhubung ke akun lain.',
    telegramGenericError: 'Gagal menghubungkan Telegram. Silakan coba lagi.',
    recommended: 'Direkomendasikan',
    orDivider: 'atau',
  },
  vi: {
    telegramTitle: 'Kết nối Telegram',
    telegramSubtitle: 'Một tài khoản trên mỗi Telegram — ngăn trùng lặp',
    telegramDescription: 'Để truy cập nhiệm vụ, hãy liên kết tài khoản Telegram. Mỗi Telegram chỉ có thể liên kết với một tài khoản Polnation.',
    telegramAlreadyBound: 'Tài khoản Telegram này đã được liên kết với tài khoản khác.',
    telegramGenericError: 'Liên kết Telegram thất bại. Vui lòng thử lại.',
    recommended: 'Khuyến nghị',
    orDivider: 'hoặc',
  },
  hi: {
    telegramTitle: 'Telegram कनेक्ट करें',
    telegramSubtitle: 'प्रति Telegram एक खाता — डुप्लिकेट रोकता है',
    telegramDescription: 'टास्क एक्सेस करने के लिए, अपना Telegram खाता लिंक करें। प्रत्येक Telegram केवल एक Polnation खाते से लिंक हो सकता है।',
    telegramAlreadyBound: 'यह Telegram खाता पहले से किसी अन्य खाते से लिंक है।',
    telegramGenericError: 'Telegram लिंक करने में विफल। कृपया पुनः प्रयास करें।',
    recommended: 'अनुशंसित',
    orDivider: 'या',
  },
  ar: {
    telegramTitle: 'ربط Telegram',
    telegramSubtitle: 'حساب واحد لكل Telegram — يمنع التكرار',
    telegramDescription: 'للوصول إلى المهام، اربط حساب Telegram الخاص بك. يمكن ربط كل Telegram بحساب Polnation واحد فقط.',
    telegramAlreadyBound: 'هذا الحساب على Telegram مرتبط بالفعل بحساب آخر.',
    telegramGenericError: 'فشل ربط Telegram. يرجى المحاولة مرة أخرى.',
    recommended: 'موصى به',
    orDivider: 'أو',
  },
  ur: {
    telegramTitle: 'Telegram جوڑیں',
    telegramSubtitle: 'ہر Telegram کے لیے ایک اکاؤنٹ — نقل کو روکتا ہے',
    telegramDescription: 'ٹاسک تک رسائی کے لیے، اپنا Telegram اکاؤنٹ جوڑیں۔ ہر Telegram صرف ایک Polnation اکاؤنٹ سے جڑ سکتا ہے۔',
    telegramAlreadyBound: 'یہ Telegram اکاؤنٹ پہلے سے کسی اور اکاؤنٹ سے منسلک ہے۔',
    telegramGenericError: 'Telegram جوڑنے میں ناکام۔ براہ کرم دوبارہ کوشش کریں۔',
    recommended: 'تجویز کردہ',
    orDivider: 'یا',
  },
}

const LANGS = ['en', 'zh', 'fr', 'id', 'vi', 'hi', 'ar', 'ur']

for (const lang of LANGS) {
  const filePath = path.join(MESSAGES_DIR, `${lang}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  data.verifyGate = { ...(data.verifyGate || {}), ...KEYS[lang] }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`✓ ${lang}.json updated`)
}

console.log('Done.')
