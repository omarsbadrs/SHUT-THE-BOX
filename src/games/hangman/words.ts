import type { HmLanguage } from "./letters";

export type HmCategory = "animals" | "countries" | "food" | "sports" | "jobs" | "home" | "nature";
export const CATEGORIES: HmCategory[] = ["animals", "countries", "food", "sports", "jobs", "home", "nature"];

/** Built-in word lists. Arabic entries are written without tashkeel. */
export const WORDS: Record<HmLanguage, Record<HmCategory, string[]>> = {
  en: {
    animals: [
      "LION", "TIGER", "ELEPHANT", "GIRAFFE", "ZEBRA", "MONKEY", "KANGAROO", "PENGUIN", "DOLPHIN", "SHARK",
      "WHALE", "EAGLE", "OWL", "RABBIT", "TURTLE", "CAMEL", "HORSE", "DONKEY", "SQUIRREL", "CROCODILE",
      "BUTTERFLY", "SPIDER", "OCTOPUS", "PARROT", "FLAMINGO", "CHEETAH", "GORILLA", "HAMSTER", "LOBSTER", "PEACOCK",
      "HEDGEHOG", "JELLYFISH", "POLAR BEAR", "SEA HORSE", "WOLF", "FOX", "DEER", "FROG",
    ],
    countries: [
      "EGYPT", "FRANCE", "BRAZIL", "CANADA", "JAPAN", "CHINA", "INDIA", "MEXICO", "ITALY", "SPAIN",
      "GERMANY", "PORTUGAL", "ARGENTINA", "AUSTRALIA", "MOROCCO", "TUNISIA", "ALGERIA", "JORDAN", "LEBANON", "KUWAIT",
      "QATAR", "OMAN", "TURKEY", "GREECE", "SWEDEN", "NORWAY", "KENYA", "NIGERIA", "CHILE", "PERU",
      "SAUDI ARABIA", "NEW ZEALAND", "SOUTH KOREA", "ICELAND", "IRELAND",
    ],
    food: [
      "PIZZA", "BURGER", "PASTA", "SANDWICH", "PANCAKE", "WAFFLE", "CHOCOLATE", "BANANA", "STRAWBERRY", "PINEAPPLE",
      "WATERMELON", "AVOCADO", "CARROT", "POTATO", "TOMATO", "CUCUMBER", "BROCCOLI", "CHEESE", "YOGURT", "OMELETTE",
      "FALAFEL", "SHAWARMA", "KEBAB", "HUMMUS", "DONUT", "POPCORN", "NOODLES", "CROISSANT", "CUPCAKE", "ICE CREAM",
      "FRENCH FRIES", "LEMON", "MANGO",
    ],
    sports: [
      "FOOTBALL", "BASKETBALL", "TENNIS", "VOLLEYBALL", "BASEBALL", "SWIMMING", "BOXING", "KARATE", "CYCLING", "SURFING",
      "SKIING", "GOLF", "HOCKEY", "RUGBY", "CRICKET", "ARCHERY", "FENCING", "ROWING", "SQUASH", "BADMINTON",
      "MARATHON", "GYMNASTICS", "WRESTLING", "BOWLING", "SNOOKER", "TABLE TENNIS", "HIGH JUMP", "JUDO", "DIVING",
    ],
    jobs: [
      "DOCTOR", "TEACHER", "ENGINEER", "PILOT", "NURSE", "CHEF", "FARMER", "POLICE", "LAWYER", "DENTIST",
      "ARTIST", "SINGER", "ACTOR", "DRIVER", "BAKER", "BARBER", "CARPENTER", "PLUMBER", "ELECTRICIAN", "JOURNALIST",
      "SCIENTIST", "ASTRONAUT", "FIREFIGHTER", "PHOTOGRAPHER", "ARCHITECT", "MECHANIC", "TAILOR", "PHARMACIST", "ACCOUNTANT", "PROGRAMMER",
    ],
    home: [
      "TABLE", "CHAIR", "SOFA", "PILLOW", "BLANKET", "MIRROR", "WINDOW", "CURTAIN", "CARPET", "LAMP",
      "CLOCK", "OVEN", "FRIDGE", "KETTLE", "TOASTER", "TELEVISION", "KEYBOARD", "UMBRELLA", "SCISSORS", "TOOTHBRUSH",
      "BATHTUB", "WARDROBE", "BOOKSHELF", "CANDLE", "BUCKET", "LADDER", "HAMMER", "WASHING MACHINE", "REMOTE CONTROL", "SPOON",
    ],
    nature: [
      "MOUNTAIN", "VOLCANO", "RIVER", "OCEAN", "DESERT", "FOREST", "RAINBOW", "THUNDER", "LIGHTNING", "WATERFALL",
      "ISLAND", "GLACIER", "CANYON", "SUNSET", "MOONLIGHT", "TORNADO", "EARTHQUAKE", "SNOWFLAKE", "BEACH", "CLOUD",
      "OASIS", "JUNGLE", "VALLEY", "CAVE", "METEOR", "GALAXY", "PLANET", "SUNFLOWER",
    ],
  },
  ar: {
    animals: [
      "أسد", "نمر", "فيل", "زرافة", "حمار وحشي", "قرد", "كنغر", "بطريق", "دلفين", "قرش",
      "حوت", "نسر", "بومة", "أرنب", "سلحفاة", "جمل", "حصان", "حمار", "سنجاب", "تمساح",
      "فراشة", "عنكبوت", "أخطبوط", "ببغاء", "فهد", "غوريلا", "طاووس", "قنفذ", "ذئب", "ثعلب",
      "غزال", "دب قطبي", "نحلة", "ضفدع",
    ],
    countries: [
      "مصر", "فرنسا", "البرازيل", "كندا", "اليابان", "الصين", "الهند", "المكسيك", "إيطاليا", "إسبانيا",
      "ألمانيا", "البرتغال", "الأرجنتين", "أستراليا", "المغرب", "تونس", "الجزائر", "الأردن", "لبنان", "الكويت",
      "قطر", "عمان", "تركيا", "اليونان", "السويد", "النرويج", "كينيا", "نيجيريا", "السعودية", "الإمارات",
      "العراق", "سوريا", "فلسطين", "السودان", "ليبيا", "اليمن", "البحرين",
    ],
    food: [
      "بيتزا", "برجر", "مكرونة", "شطيرة", "فطيرة", "شوكولاتة", "موز", "فراولة", "أناناس", "بطيخ",
      "أفوكادو", "جزر", "بطاطس", "طماطم", "خيار", "جبنة", "زبادي", "عجة", "فلافل", "شاورما",
      "كباب", "حمص", "كنافة", "بسبوسة", "فشار", "كرواسون", "مثلجات", "كشري", "ملوخية", "فول",
      "تمر", "عنب", "برتقال", "رمان",
    ],
    sports: [
      "كرة القدم", "كرة السلة", "التنس", "كرة الطائرة", "السباحة", "الملاكمة", "الكاراتيه", "التزلج", "الجولف", "الهوكي",
      "الرجبي", "الكريكيت", "الرماية", "المبارزة", "التجديف", "الاسكواش", "الريشة الطائرة", "الماراثون", "الجمباز", "المصارعة",
      "البولينج", "الفروسية", "الغوص", "كرة اليد", "تنس الطاولة", "الجودو",
    ],
    jobs: [
      "طبيب", "معلم", "مهندس", "طيار", "ممرض", "طباخ", "مزارع", "شرطي", "محامي", "طبيب أسنان",
      "رسام", "مغني", "ممثل", "سائق", "خباز", "حلاق", "نجار", "سباك", "كهربائي", "صحفي",
      "عالم", "رائد فضاء", "رجل إطفاء", "مصور", "معماري", "ميكانيكي", "خياط", "صيدلي", "محاسب", "مبرمج",
    ],
    home: [
      "طاولة", "كرسي", "أريكة", "وسادة", "بطانية", "مرآة", "نافذة", "ستارة", "سجادة", "مصباح",
      "ساعة", "فرن", "ثلاجة", "غلاية", "تلفاز", "لوحة مفاتيح", "مظلة", "مقص", "فرشاة أسنان", "خزانة",
      "مكتبة", "شمعة", "دلو", "سلم", "مطرقة", "غسالة", "ملعقة", "شوكة", "سكين", "مكنسة",
    ],
    nature: [
      "جبل", "بركان", "نهر", "محيط", "صحراء", "غابة", "قوس قزح", "رعد", "برق", "شلال",
      "جزيرة", "كهف", "وادي", "شروق", "غروب", "إعصار", "زلزال", "ثلج", "شاطئ", "سحابة",
      "واحة", "مجرة", "كوكب", "نجمة", "قمر", "شمس", "عاصفة", "بحيرة", "زهرة", "شجرة",
    ],
  },
};

export function wordsFor(lang: HmLanguage, category: HmCategory | "mixed"): string[] {
  if (category === "mixed") return CATEGORIES.flatMap((c) => WORDS[lang][c]);
  return WORDS[lang][category];
}

/** Category a built-in word belongs to (for display when "mixed" is chosen). */
export function categoryOf(lang: HmLanguage, word: string): HmCategory | null {
  for (const c of CATEGORIES) if (WORDS[lang][c].includes(word)) return c;
  return null;
}
