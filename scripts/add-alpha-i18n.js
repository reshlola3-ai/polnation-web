const fs = require('fs')
const path = require('path')

const translations = {
  en: {
    poweredBy: "Powered by Arkham Intelligence",
    title: "Alpha Lead Tracker",
    subtitle: "Smart-money signals · Powered by your stake",
    portfolio: {
      heading: "Portfolio Overview · Polygon",
      usdcBalance: "USDC Balance",
      available: "Available to stake",
      totalAssets: "Total Assets",
      stakingReturns: "staking returns",
      myPositions: "My Positions",
      staked: "staked",
      view: "View"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "Stake USDC · Earn alpha-driven returns · Polygon",
      engineActive: "Engine Active",
      capacityBanner: "Capacity Full — Not Accepting New Stakes",
      capacityDesc: "Current staking period has reached capacity. The next opening will be announced in our community.",
      selectPeriod: "Select Lock Period",
      days: "days",
      amount: "Amount",
      minError: "Minimum stake is $50 USDC",
      calculatorTitle: "Yield Calculator",
      daily: "Daily",
      sevenDays: "7 Days",
      thirtyDays: "30 Days",
      totalLabel: "Total",
      stakeBtn: "Stake ${amount} for ${days} Days",
      enterMin: "Enter at least $50 USDC",
      capacityBtn: "Capacity Full",
      capacityTooltip: "Staking is at capacity. Stay tuned for the next opening announcement.",
      nonCustodial: "Non-Custodial",
      gaslessPermit: "Gasless Permit",
      alphaDriven: "Alpha-Driven",
      signingPermit: "Signing Permit…"
    },
    positions: {
      title: "Your Positions",
      active: "active",
      claimable: "Claimable",
      principal: "Principal",
      daysLeft: "Days Left",
      nextReward: "Next Reward",
      day: "Day",
      claimBtn: "Claim Rewards",
      claiming: "Claiming…",
      unstakeEarly: "Unstake Early",
      confirmUnstake: "Confirm Unstake",
      unstaking: "Unstaking…",
      penaltyWarning: "Early unstake deducts {penalty} (15%) from your principal. You receive {amount}."
    },
    signals: {
      title: "Signals We Acted On",
      signals: "signals",
      acted: "Acted",
      confidence: "Confidence",
      entity: "Entity",
      token: "Token",
      chain: "Chain",
      signalReading: "Signal Reading",
      whatHappened: "What Happened",
      empty: "No signals recorded yet"
    },
    stats: {
      heading: "Signal Engine Stats"
    }
  },

  zh: {
    poweredBy: "由 Arkham Intelligence 驱动",
    title: "Alpha 领先追踪器",
    subtitle: "聪明钱信号 · 由您的质押驱动",
    portfolio: {
      heading: "投资组合总览 · Polygon",
      usdcBalance: "USDC 余额",
      available: "可质押金额",
      totalAssets: "总资产",
      stakingReturns: "质押收益",
      myPositions: "我的仓位",
      staked: "已质押",
      view: "查看"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "质押 USDC · 获取 Alpha 驱动收益 · Polygon",
      engineActive: "引擎运行中",
      capacityBanner: "额度已满，暂停开放",
      capacityDesc: "当前质押期已达上限。新一期开放时间将在社群公布，敬请关注。",
      selectPeriod: "选择锁仓期",
      days: "天",
      amount: "金额",
      minError: "最低质押为 $50 USDC",
      calculatorTitle: "收益计算器",
      daily: "每日",
      sevenDays: "7天",
      thirtyDays: "30天",
      totalLabel: "合计",
      stakeBtn: "质押 ${amount}，锁仓 ${days} 天",
      enterMin: "请输入至少 $50 USDC",
      capacityBtn: "额度已满",
      capacityTooltip: "当前质押额度已满，请关注社群公告了解下一期开放时间。",
      nonCustodial: "非托管",
      gaslessPermit: "无Gas授权",
      alphaDriven: "Alpha驱动",
      signingPermit: "签名授权中…"
    },
    positions: {
      title: "我的仓位",
      active: "活跃",
      claimable: "可领取",
      principal: "本金",
      daysLeft: "剩余天数",
      nextReward: "下次奖励",
      day: "第",
      claimBtn: "领取奖励",
      claiming: "领取中…",
      unstakeEarly: "提前解锁",
      confirmUnstake: "确认解锁",
      unstaking: "解锁中…",
      penaltyWarning: "提前解锁将扣除本金的 {penalty}（15%），您将收到 {amount}。"
    },
    signals: {
      title: "我们操作的信号",
      signals: "条信号",
      acted: "已操作",
      confidence: "置信度",
      entity: "实体",
      token: "代币",
      chain: "链",
      signalReading: "信号解读",
      whatHappened: "发生了什么",
      empty: "暂无信号记录"
    },
    stats: {
      heading: "信号引擎统计"
    }
  },

  fr: {
    poweredBy: "Propulsé par Arkham Intelligence",
    title: "Alpha Lead Tracker",
    subtitle: "Signaux d'argent intelligent · Alimenté par votre mise",
    portfolio: {
      heading: "Aperçu du portefeuille · Polygon",
      usdcBalance: "Solde USDC",
      available: "Disponible pour miser",
      totalAssets: "Actifs totaux",
      stakingReturns: "rendement de mise",
      myPositions: "Mes positions",
      staked: "misé",
      view: "Voir"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "Misez USDC · Gagnez des rendements Alpha · Polygon",
      engineActive: "Moteur actif",
      capacityBanner: "Capacité atteinte — Nouvelles mises suspendues",
      capacityDesc: "La période de mise actuelle a atteint sa capacité. La prochaine ouverture sera annoncée dans notre communauté.",
      selectPeriod: "Sélectionner la période de blocage",
      days: "jours",
      amount: "Montant",
      minError: "La mise minimale est de 50 $ USDC",
      calculatorTitle: "Calculateur de rendement",
      daily: "Quotidien",
      sevenDays: "7 jours",
      thirtyDays: "30 jours",
      totalLabel: "Total",
      stakeBtn: "Miser ${amount} pendant ${days} jours",
      enterMin: "Entrez au moins 50 $ USDC",
      capacityBtn: "Capacité atteinte",
      capacityTooltip: "La mise est actuellement à pleine capacité. Restez à l'écoute pour la prochaine ouverture.",
      nonCustodial: "Non-custodial",
      gaslessPermit: "Autorisation sans gas",
      alphaDriven: "Piloté par Alpha",
      signingPermit: "Signature en cours…"
    },
    positions: {
      title: "Vos positions",
      active: "actives",
      claimable: "Réclamable",
      principal: "Principal",
      daysLeft: "Jours restants",
      nextReward: "Prochaine récompense",
      day: "Jour",
      claimBtn: "Réclamer les récompenses",
      claiming: "Réclamation…",
      unstakeEarly: "Retrait anticipé",
      confirmUnstake: "Confirmer le retrait",
      unstaking: "Retrait en cours…",
      penaltyWarning: "Le retrait anticipé déduit {penalty} (15%) de votre principal. Vous recevrez {amount}."
    },
    signals: {
      title: "Signaux sur lesquels nous avons agi",
      signals: "signaux",
      acted: "Exécuté",
      confidence: "Confiance",
      entity: "Entité",
      token: "Jeton",
      chain: "Chaîne",
      signalReading: "Lecture du signal",
      whatHappened: "Ce qui s'est passé",
      empty: "Aucun signal enregistré"
    },
    stats: {
      heading: "Statistiques du moteur de signaux"
    }
  },

  id: {
    poweredBy: "Didukung oleh Arkham Intelligence",
    title: "Alpha Lead Tracker",
    subtitle: "Sinyal uang pintar · Didukung oleh staking Anda",
    portfolio: {
      heading: "Ikhtisar Portofolio · Polygon",
      usdcBalance: "Saldo USDC",
      available: "Tersedia untuk staking",
      totalAssets: "Total Aset",
      stakingReturns: "hasil staking",
      myPositions: "Posisi Saya",
      staked: "di-staking",
      view: "Lihat"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "Stake USDC · Dapatkan hasil berbasis Alpha · Polygon",
      engineActive: "Mesin Aktif",
      capacityBanner: "Kapasitas Penuh — Tidak Menerima Staking Baru",
      capacityDesc: "Periode staking saat ini telah mencapai kapasitas. Pembukaan berikutnya akan diumumkan di komunitas kami.",
      selectPeriod: "Pilih Periode Kunci",
      days: "hari",
      amount: "Jumlah",
      minError: "Staking minimum adalah $50 USDC",
      calculatorTitle: "Kalkulator Hasil",
      daily: "Harian",
      sevenDays: "7 Hari",
      thirtyDays: "30 Hari",
      totalLabel: "Total",
      stakeBtn: "Stake ${amount} selama ${days} Hari",
      enterMin: "Masukkan minimal $50 USDC",
      capacityBtn: "Kapasitas Penuh",
      capacityTooltip: "Staking saat ini sudah penuh. Pantau pengumuman komunitas untuk pembukaan berikutnya.",
      nonCustodial: "Non-Kustodial",
      gaslessPermit: "Izin Tanpa Gas",
      alphaDriven: "Berbasis Alpha",
      signingPermit: "Menandatangani Izin…"
    },
    positions: {
      title: "Posisi Anda",
      active: "aktif",
      claimable: "Dapat Diklaim",
      principal: "Pokok",
      daysLeft: "Hari Tersisa",
      nextReward: "Hadiah Berikutnya",
      day: "Hari",
      claimBtn: "Klaim Hadiah",
      claiming: "Mengklaim…",
      unstakeEarly: "Unstake Awal",
      confirmUnstake: "Konfirmasi Unstake",
      unstaking: "Unstaking…",
      penaltyWarning: "Unstake awal memotong {penalty} (15%) dari pokok Anda. Anda menerima {amount}."
    },
    signals: {
      title: "Sinyal yang Kami Tindaki",
      signals: "sinyal",
      acted: "Ditindaki",
      confidence: "Kepercayaan",
      entity: "Entitas",
      token: "Token",
      chain: "Rantai",
      signalReading: "Pembacaan Sinyal",
      whatHappened: "Yang Terjadi",
      empty: "Belum ada sinyal tercatat"
    },
    stats: {
      heading: "Statistik Mesin Sinyal"
    }
  },

  vi: {
    poweredBy: "Được cung cấp bởi Arkham Intelligence",
    title: "Alpha Lead Tracker",
    subtitle: "Tín hiệu tiền thông minh · Được hỗ trợ bởi cổ phần của bạn",
    portfolio: {
      heading: "Tổng quan danh mục · Polygon",
      usdcBalance: "Số dư USDC",
      available: "Có thể đặt cọc",
      totalAssets: "Tổng tài sản",
      stakingReturns: "lợi nhuận đặt cọc",
      myPositions: "Vị thế của tôi",
      staked: "đã đặt cọc",
      view: "Xem"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "Đặt cọc USDC · Nhận lợi nhuận từ Alpha · Polygon",
      engineActive: "Động cơ hoạt động",
      capacityBanner: "Đã đầy công suất — Tạm dừng nhận cổ phần mới",
      capacityDesc: "Kỳ đặt cọc hiện tại đã đạt công suất. Đợt mở tiếp theo sẽ được thông báo trong cộng đồng của chúng tôi.",
      selectPeriod: "Chọn thời gian khóa",
      days: "ngày",
      amount: "Số tiền",
      minError: "Đặt cọc tối thiểu là $50 USDC",
      calculatorTitle: "Máy tính lợi nhuận",
      daily: "Hàng ngày",
      sevenDays: "7 ngày",
      thirtyDays: "30 ngày",
      totalLabel: "Tổng",
      stakeBtn: "Đặt cọc ${amount} trong ${days} ngày",
      enterMin: "Nhập ít nhất $50 USDC",
      capacityBtn: "Đã đầy công suất",
      capacityTooltip: "Đặt cọc đang ở công suất tối đa. Theo dõi thông báo cộng đồng để biết đợt mở tiếp theo.",
      nonCustodial: "Phi tập trung",
      gaslessPermit: "Ủy quyền không gas",
      alphaDriven: "Dựa trên Alpha",
      signingPermit: "Đang ký ủy quyền…"
    },
    positions: {
      title: "Vị thế của bạn",
      active: "hoạt động",
      claimable: "Có thể nhận",
      principal: "Vốn",
      daysLeft: "Ngày còn lại",
      nextReward: "Phần thưởng tiếp theo",
      day: "Ngày",
      claimBtn: "Nhận phần thưởng",
      claiming: "Đang nhận…",
      unstakeEarly: "Rút sớm",
      confirmUnstake: "Xác nhận rút",
      unstaking: "Đang rút…",
      penaltyWarning: "Rút sớm trừ {penalty} (15%) từ vốn của bạn. Bạn nhận được {amount}."
    },
    signals: {
      title: "Tín hiệu chúng tôi đã thực hiện",
      signals: "tín hiệu",
      acted: "Đã thực hiện",
      confidence: "Độ tin cậy",
      entity: "Thực thể",
      token: "Token",
      chain: "Chuỗi",
      signalReading: "Đọc tín hiệu",
      whatHappened: "Điều đã xảy ra",
      empty: "Chưa có tín hiệu nào"
    },
    stats: {
      heading: "Thống kê động cơ tín hiệu"
    }
  },

  hi: {
    poweredBy: "Arkham Intelligence द्वारा संचालित",
    title: "अल्फा लीड ट्रैकर",
    subtitle: "स्मार्ट मनी सिग्नल · आपकी स्टेक द्वारा संचालित",
    portfolio: {
      heading: "पोर्टफोलियो अवलोकन · Polygon",
      usdcBalance: "USDC शेष",
      available: "स्टेक के लिए उपलब्ध",
      totalAssets: "कुल संपत्ति",
      stakingReturns: "स्टेकिंग रिटर्न",
      myPositions: "मेरी पोजीशन",
      staked: "स्टेक",
      view: "देखें"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "USDC स्टेक करें · Alpha-संचालित रिटर्न कमाएं · Polygon",
      engineActive: "इंजन सक्रिय",
      capacityBanner: "क्षमता पूर्ण — नई स्टेक स्वीकार नहीं",
      capacityDesc: "वर्तमान स्टेकिंग अवधि क्षमता पर पहुंच गई है। अगला उद्घाटन हमारे समुदाय में घोषित किया जाएगा।",
      selectPeriod: "लॉक अवधि चुनें",
      days: "दिन",
      amount: "राशि",
      minError: "न्यूनतम स्टेक $50 USDC है",
      calculatorTitle: "यील्ड कैलकुलेटर",
      daily: "दैनिक",
      sevenDays: "7 दिन",
      thirtyDays: "30 दिन",
      totalLabel: "कुल",
      stakeBtn: "${days} दिनों के लिए ${amount} स्टेक करें",
      enterMin: "कम से कम $50 USDC दर्ज करें",
      capacityBtn: "क्षमता पूर्ण",
      capacityTooltip: "स्टेकिंग वर्तमान में क्षमता पर है। अगले उद्घाटन के लिए समुदाय की घोषणाओं पर नज़र रखें।",
      nonCustodial: "गैर-कस्टोडियल",
      gaslessPermit: "गैसलेस परमिट",
      alphaDriven: "Alpha-संचालित",
      signingPermit: "परमिट साइन हो रहा है…"
    },
    positions: {
      title: "आपकी पोजीशन",
      active: "सक्रिय",
      claimable: "क्लेम योग्य",
      principal: "मूलधन",
      daysLeft: "बचे दिन",
      nextReward: "अगला इनाम",
      day: "दिन",
      claimBtn: "पुरस्कार क्लेम करें",
      claiming: "क्लेम हो रहा है…",
      unstakeEarly: "जल्दी अनस्टेक",
      confirmUnstake: "अनस्टेक की पुष्टि करें",
      unstaking: "अनस्टेक हो रहा है…",
      penaltyWarning: "जल्दी अनस्टेक से आपके मूलधन का {penalty} (15%) कटेगा। आपको {amount} मिलेगा।"
    },
    signals: {
      title: "हमने जिन सिग्नल पर कार्य किया",
      signals: "सिग्नल",
      acted: "कार्रवाई की",
      confidence: "विश्वास",
      entity: "संस्था",
      token: "टोकन",
      chain: "चेन",
      signalReading: "सिग्नल रीडिंग",
      whatHappened: "क्या हुआ",
      empty: "अभी कोई सिग्नल दर्ज नहीं"
    },
    stats: {
      heading: "सिग्नल इंजन आंकड़े"
    }
  },

  ar: {
    poweredBy: "مدعوم من Arkham Intelligence",
    title: "متتبع ألفا ليد",
    subtitle: "إشارات المال الذكي · مدعوم بتعهدك",
    portfolio: {
      heading: "نظرة عامة على المحفظة · Polygon",
      usdcBalance: "رصيد USDC",
      available: "متاح للتعهد",
      totalAssets: "إجمالي الأصول",
      stakingReturns: "عوائد التعهد",
      myPositions: "مراكزي",
      staked: "متعهد",
      view: "عرض"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "تعهد USDC · اكسب عوائد مدفوعة بألفا · Polygon",
      engineActive: "المحرك نشط",
      capacityBanner: "الطاقة الاستيعابية ممتلئة — تعليق القبول",
      capacityDesc: "وصلت فترة التعهد الحالية إلى طاقتها الاستيعابية. سيتم الإعلان عن الفتح التالي في مجتمعنا.",
      selectPeriod: "اختر فترة القفل",
      days: "أيام",
      amount: "المبلغ",
      minError: "الحد الأدنى للتعهد هو 50 دولار USDC",
      calculatorTitle: "حاسبة العائد",
      daily: "يومي",
      sevenDays: "7 أيام",
      thirtyDays: "30 يومًا",
      totalLabel: "الإجمالي",
      stakeBtn: "تعهد ${amount} لمدة ${days} يومًا",
      enterMin: "أدخل ما لا يقل عن 50 دولار USDC",
      capacityBtn: "الطاقة ممتلئة",
      capacityTooltip: "التعهد حاليًا عند طاقة كاملة. تابع إعلانات المجتمع للفتح التالي.",
      nonCustodial: "غير احترازي",
      gaslessPermit: "تصريح بدون غاز",
      alphaDriven: "مدفوع بألفا",
      signingPermit: "جارٍ توقيع التصريح…"
    },
    positions: {
      title: "مراكزك",
      active: "نشط",
      claimable: "قابل للمطالبة",
      principal: "رأس المال",
      daysLeft: "الأيام المتبقية",
      nextReward: "المكافأة التالية",
      day: "اليوم",
      claimBtn: "المطالبة بالمكافآت",
      claiming: "جارٍ المطالبة…",
      unstakeEarly: "إلغاء التعهد مبكرًا",
      confirmUnstake: "تأكيد إلغاء التعهد",
      unstaking: "جارٍ إلغاء التعهد…",
      penaltyWarning: "إلغاء التعهد المبكر يخصم {penalty} (15%) من رأس مالك. ستتلقى {amount}."
    },
    signals: {
      title: "الإشارات التي تصرفنا بناءً عليها",
      signals: "إشارات",
      acted: "تم التصرف",
      confidence: "الثقة",
      entity: "الكيان",
      token: "الرمز",
      chain: "السلسلة",
      signalReading: "قراءة الإشارة",
      whatHappened: "ما الذي حدث",
      empty: "لا توجد إشارات مسجلة بعد"
    },
    stats: {
      heading: "إحصاءات محرك الإشارات"
    }
  },

  ur: {
    poweredBy: "Arkham Intelligence کے ذریعے",
    title: "الفا لیڈ ٹریکر",
    subtitle: "ہوشیار پیسے کے اشارے · آپ کے اسٹیک سے چلتا ہے",
    portfolio: {
      heading: "پورٹ فولیو کا جائزہ · Polygon",
      usdcBalance: "USDC بیلنس",
      available: "اسٹیک کے لیے دستیاب",
      totalAssets: "کل اثاثے",
      stakingReturns: "اسٹیکنگ منافع",
      myPositions: "میری پوزیشنز",
      staked: "اسٹیک",
      view: "دیکھیں"
    },
    stake: {
      title: "AlphaStake",
      subtitle: "USDC اسٹیک کریں · Alpha پر مبنی منافع کمائیں · Polygon",
      engineActive: "انجن فعال",
      capacityBanner: "گنجائش بھر گئی — نئے اسٹیک قبول نہیں",
      capacityDesc: "موجودہ اسٹیکنگ مدت اپنی گنجائش تک پہنچ گئی ہے۔ اگلی افتتاح ہمارے کمیونٹی میں اعلان کی جائے گی۔",
      selectPeriod: "لاک مدت منتخب کریں",
      days: "دن",
      amount: "رقم",
      minError: "کم از کم اسٹیک $50 USDC ہے",
      calculatorTitle: "یلڈ کیلکولیٹر",
      daily: "یومیہ",
      sevenDays: "7 دن",
      thirtyDays: "30 دن",
      totalLabel: "کل",
      stakeBtn: "${days} دن کے لیے ${amount} اسٹیک کریں",
      enterMin: "کم از کم $50 USDC درج کریں",
      capacityBtn: "گنجائش بھری",
      capacityTooltip: "اسٹیکنگ فی الحال مکمل گنجائش پر ہے۔ اگلی افتتاح کے لیے کمیونٹی اعلانات دیکھتے رہیں۔",
      nonCustodial: "غیر تحویلی",
      gaslessPermit: "بغیر گیس اجازت",
      alphaDriven: "Alpha سے چلتا ہے",
      signingPermit: "اجازت دستخط ہو رہی ہے…"
    },
    positions: {
      title: "آپ کی پوزیشنز",
      active: "فعال",
      claimable: "قابل دعوی",
      principal: "اصل رقم",
      daysLeft: "باقی دن",
      nextReward: "اگلا انعام",
      day: "دن",
      claimBtn: "انعام حاصل کریں",
      claiming: "حاصل ہو رہا ہے…",
      unstakeEarly: "جلد انسٹیک",
      confirmUnstake: "انسٹیک کی تصدیق",
      unstaking: "انسٹیک ہو رہا ہے…",
      penaltyWarning: "جلد انسٹیک سے آپ کی اصل رقم کا {penalty} (15%) کٹے گا۔ آپ کو {amount} ملے گا۔"
    },
    signals: {
      title: "وہ اشارے جن پر ہم نے عمل کیا",
      signals: "اشارے",
      acted: "عمل کیا",
      confidence: "اعتماد",
      entity: "ادارہ",
      token: "ٹوکن",
      chain: "چین",
      signalReading: "اشارے کی تشریح",
      whatHappened: "کیا ہوا",
      empty: "ابھی کوئی اشارہ ریکارڈ نہیں"
    },
    stats: {
      heading: "سگنل انجن کے اعداد و شمار"
    }
  }
}

// Inject "alpha" section into each language file
const messagesDir = path.join(__dirname, '../messages')

Object.entries(translations).forEach(([lang, alphaData]) => {
  const filePath = path.join(messagesDir, `${lang}.json`)
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  existing.alpha = alphaData
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8')
  console.log(`✓ ${lang}.json updated`)
})

console.log('\nDone. Alpha i18n injected into all 8 language files.')
