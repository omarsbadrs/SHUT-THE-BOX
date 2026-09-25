/**
 * Guess Who card decks. Every card has a free-licensed photo in
 * /public/guesswho/<category>/<id>.webp (see credits.json) and tags that
 * answer the ready-made yes/no questions. Visual tags (glasses, moustache,
 * black & white…) describe the card's photo, so they were checked against it.
 */

export type GwCategory = "food" | "stars" | "music_sport" | "pharaohs";
export const GW_CATEGORIES: GwCategory[] = ["food", "stars", "music_sport", "pharaohs"];

export interface GwCard {
  /** "<category>/<slug>" — also the image path. */
  id: string;
  category: GwCategory;
  en: string;
  ar: string;
  tags: string[];
}

export interface GwQuestion {
  id: string;
  category: GwCategory;
  en: string;
  ar: string;
  tag: string;
}

// slug | English | Arabic | tags
const DECKS: Record<GwCategory, string> = {
  food: `
koshary|Koshary|كشري|street hot rice beans spoon
ful|Ful Medames|فول مدمس|beans breakfast street hot
taameya|Ta'meya|طعمية|fried beans breakfast street hot
molokhia|Molokhia|ملوخية|green hot spoon
basbousa|Basbousa|بسبوسة|dessert baked nuts
konafa|Konafa|كنافة|dessert baked nuts ramadan dough
om_ali|Om Ali|أم علي|dessert baked nuts hot spoon dough
feteer|Feteer Meshaltet|فطير مشلتت|baked dough hot breakfast
mahshi|Mahshi|محشي|rice hot
hawawshi|Hawawshi|حواوشي|meat baked dough street hot
hamam|Stuffed Pigeon|حمام محشي|meat rice hot
fesikh|Fesikh|فسيخ|meat
lentil_soup|Lentil Soup|شوربة عدس|beans hot spoon
roz_bel_laban|Roz Bel Laban|رز بلبن|dessert rice spoon nuts
qatayef|Qatayef|قطايف|dessert fried dough nuts ramadan
kahk|Kahk|كحك|dessert baked dough ramadan
balah_el_sham|Balah El Sham|بلح الشام|dessert fried dough street
zalabya|Zalabya|زلابية|dessert fried dough street
sahlab|Sahlab|سحلب|drink hot
karkade|Karkade|كركديه|drink ramadan
shawarma|Shawarma|شاورما|meat street hot dough
torshi|Torshi|طرشي|green
sugarcane|Sugarcane Juice|عصير قصب|drink green street
sobia|Sobia|سوبيا|drink ramadan
eggah|Eggah|عجة|breakfast fried hot`,
  stars: `
adel_emam|Adel Emam|عادل إمام|comedian tie
ahmed_zaki|Ahmed Zaki|أحمد زكي|tie
omar_sharif|Omar Sharif|عمر الشريف|bw moustache tie
faten_hamama|Faten Hamama|فاتن حمامة|female
soad_hosny|Soad Hosny|سعاد حسني|female
mahmoud_abdelaziz|Mahmoud Abdel Aziz|محمود عبد العزيز|grey moustache
nour_elsherif|Nour El-Sherif|نور الشريف|glasses smile tie
yousra|Yousra|يسرا|female light_hair earrings mic
laila_elwi|Laila Elwi|ليلى علوي|female smile
hind_rostom|Hind Rostom|هند رستم|female light_hair
rushdy_abaza|Rushdy Abaza|رشدي أباظة|bw moustache
ismail_yassin|Ismail Yassin|إسماعيل ياسين|bw smile tie comedian
ahmed_helmy|Ahmed Helmy|أحمد حلمي|glasses beard moustache tie mic comedian
mohamed_henedi|Mohamed Henedi|محمد هنيدي|hat comedian
karim_abdelaziz|Karim Abdel Aziz|كريم عبد العزيز|
ahmed_ezz|Ahmed Ezz|أحمد عز|smile tie
mona_zaki|Mona Zaki|منى زكي|female mic
mohamed_ramadan|Mohamed Ramadan|محمد رمضان|glasses mic smile
yehia_fakharany|Yehia El-Fakharany|يحيى الفخراني|grey beard moustache
nelly_karim|Nelly Karim|نيللي كريم|female
amr_waked|Amr Waked|عمرو واكد|grey smile
khaled_nabawy|Khaled El Nabawy|خالد النبوي|mic
ahmed_sakka|Ahmed El Sakka|أحمد السقا|smile
donia_samir_ghanem|Donia Samir Ghanem|دنيا سمير غانم|female mic comedian
ghada_abdelrazek|Ghada Abdel Razek|غادة عبد الرازق|female curly
nabila_ebeid|Nabila Ebeid|نبيلة عبيد|female light_hair earrings
samir_ghanem|Samir Ghanem|سمير غانم|glasses moustache smile comedian
fouad_elmohandes|Fouad El-Mohandes|فؤاد المهندس|glasses bw comedian
hussein_fahmy|Hussein Fahmy|حسين فهمي|grey tie smile
amina_khalil|Amina Khalil|أمينة خليل|female smile earrings
asser_yassin|Asser Yassin|آسر ياسين|curly`,
  music_sport: `
umm_kulthum|Umm Kulthum|أم كلثوم|female earrings bw
abdel_halim|Abdel Halim Hafez|عبد الحليم حافظ|smile tie
abdel_wahab|Mohamed Abdel Wahab|محمد عبد الوهاب|bw tie
farid_atrash|Farid al-Atrash|فريد الأطرش|bw tie
shadia|Shadia|شادية|female
amr_diab|Amr Diab|عمرو دياب|smile
mohamed_mounir|Mohamed Mounir|محمد منير|curly grey
sherine|Sherine|شيرين|female mic
tamer_hosny|Tamer Hosny|تامر حسني|mic beard moustache smile
angham|Angham|أنغام|female earrings smile
hakim|Hakim|حكيم|smile
wegz|Wegz|ويجز|mic beard moustache
dalida|Dalida|داليدا|female light_hair
sayed_darwish|Sayed Darwish|سيد درويش|bw curly moustache
mohamed_salah|Mohamed Salah|محمد صلاح|footballer europe beard moustache curly jersey
aboutrika|Mohamed Aboutrika|محمد أبو تريكة|footballer ahly jersey
ahmed_hassan|Ahmed Hassan|أحمد حسن|footballer ahly zamalek europe beard moustache
hadary|Essam El Hadary|عصام الحضري|footballer ahly zamalek europe jersey
elneny|Mohamed Elneny|محمد النني|footballer europe beard moustache curly jersey
marmoush|Omar Marmoush|عمر مرموش|footballer europe beard moustache curly jersey smile
trezeguet|Trezeguet|تريزيجيه|footballer ahly europe beard moustache jersey smile
mido|Mido|ميدو|footballer zamalek europe beard moustache curly
zidan|Mohamed Zidan|محمد زيدان|footballer europe glasses
khatib|Mahmoud El Khatib|محمود الخطيب|footballer ahly curly jersey
shehata|Hassan Shehata|حسن شحاتة|footballer zamalek grey moustache
wael_gomaa|Wael Gomaa|وائل جمعة|footballer ahly jersey
mohamed_barakat|Mohamed Barakat|محمد بركات|footballer ahly`,
  pharaohs: `
tutankhamun|Tutankhamun|توت عنخ آمون|person ancient headdress cairo gold
ramesses2|Ramesses II|رمسيس الثاني|person ancient abroad headdress statue
nefertiti|Nefertiti|نفرتيتي|person female ancient abroad headdress statue
cleopatra|Cleopatra|كليوباترا|person female ancient abroad statue
akhenaten|Akhenaten|إخناتون|person ancient headdress statue cairo
hatshepsut|Hatshepsut|حتشبسوت|person female ancient abroad headdress statue
khufu|Khufu|خوفو|person ancient statue cairo
thutmose3|Thutmose III|تحتمس الثالث|person ancient headdress statue upper
seti1|Seti I|سيتي الأول|person ancient abroad headdress statue
nefertari|Nefertari|نفرتاري|person female ancient headdress upper
sphinx|The Sphinx|أبو الهول|ancient cairo statue desert
pyramids|Pyramids of Giza|أهرامات الجيزة|ancient cairo pyramid desert
abu_simbel|Abu Simbel|أبو سمبل|ancient temple upper
karnak|Karnak Temple|معبد الكرنك|ancient temple upper
luxor_temple|Luxor Temple|معبد الأقصر|ancient temple upper night
valley_kings|Valley of the Kings|وادي الملوك|ancient upper desert
cairo_tower|Cairo Tower|برج القاهرة|cairo
khan_khalili|Khan El-Khalili|خان الخليلي|cairo
citadel|Saladin Citadel|قلعة صلاح الدين|cairo
azhar|Al-Azhar Mosque|الجامع الأزهر|cairo religious
qaitbay|Qaitbay Citadel|قلعة قايتباي|water
philae|Philae Temple|معبد فيلة|ancient temple upper night
siwa|Siwa Oasis|واحة سيوة|desert
white_desert|White Desert|الصحراء البيضاء|desert
st_catherine|St. Catherine's Monastery|دير سانت كاترين|religious desert
egyptian_museum|Egyptian Museum|المتحف المصري|cairo
hanging_church|The Hanging Church|الكنيسة المعلقة|religious cairo
sinai|Mount Sinai|جبل موسى|desert
suez_canal|Suez Canal|قناة السويس|water
step_pyramid|Step Pyramid of Djoser|هرم زوسر المدرج|ancient cairo pyramid desert
hathor_dendera|Dendera Temple|معبد دندرة|ancient temple
narmer|King Narmer|الملك نارمر|person ancient headdress cairo
tiye|Queen Tiye|الملكة تي|person female ancient abroad headdress`,
};

// id | English | Arabic | tag
const QUESTION_TEXT: Record<GwCategory, string> = {
  food: `
dessert|Is it a dessert?|هل هي حلويات؟|dessert
drink|Is it a drink?|هل هو مشروب؟|drink
meat|Does it have meat, chicken or fish?|فيها لحمة أو فراخ أو سمك؟|meat
fried|Is it fried?|هل هي مقلية؟|fried
baked|Is it baked in the oven?|بتدخل الفرن؟|baked
beans|Is it made with beans or lentils?|معمولة من فول أو عدس؟|beans
hot|Is it served hot?|بتتاكل سخنة؟|hot
breakfast|Is it a breakfast favourite?|أكلة فطار؟|breakfast
ramadan|Is it a Ramadan or Eid favourite?|من أكلات رمضان أو العيد؟|ramadan
street|Is it sold as street food?|بتتباع في الشارع؟|street
green|Is it green?|لونها أخضر؟|green
nuts|Does it have nuts?|فيها مكسرات؟|nuts
spoon|Is it eaten with a spoon?|بتتاكل بالمعلقة؟|spoon
dough|Is it made with dough or bread?|معمولة من عجين أو عيش؟|dough
rice|Does it have rice?|فيها رز؟|rice`,
  stars: `
female|Is it a woman?|هل هي ست؟|female
glasses|Wearing glasses or sunglasses?|لابس نضارة؟|glasses
moustache|Has a moustache?|عنده شنب؟|moustache
beard|Has a beard?|عنده دقن؟|beard
grey|Grey or white hair?|شعره أبيض أو رمادي؟|grey
light_hair|Blonde or red hair?|شعرها أشقر أو أحمر؟|light_hair
curly|Curly hair?|شعره كيرلي؟|curly
bw|Is it a black & white photo?|الصورة أبيض وأسود؟|bw
smile|Smiling with teeth showing?|بيضحك وسنانه باينة؟|smile
tie|Wearing a tie or bow tie?|لابس كرافتة أو بيبيون؟|tie
mic|Holding a microphone?|ماسك مايك؟|mic
earrings|Wearing earrings?|لابسة حلق؟|earrings
hat|Wearing a hat or cap?|لابس كاب أو برنيطة؟|hat
comedian|Famous for comedy?|مشهور بالكوميديا؟|comedian`,
  music_sport: `
female|Is it a woman?|هل هي ست؟|female
footballer|Is it a footballer?|لاعب كورة؟|footballer
ahly|Played for Al Ahly?|لعب للأهلي؟|ahly
zamalek|Played for Zamalek?|لعب للزمالك؟|zamalek
europe|Played in Europe?|لعب في أوروبا؟|europe
jersey|Wearing a football shirt?|لابس تيشيرت كورة؟|jersey
beard|Has a beard?|عنده دقن؟|beard
moustache|Has a moustache?|عنده شنب؟|moustache
curly|Curly hair?|شعره كيرلي؟|curly
grey|Grey or white hair?|شعره أبيض أو رمادي؟|grey
bw|Is it a black & white photo?|الصورة أبيض وأسود؟|bw
smile|Smiling with teeth showing?|بيضحك وسنانه باينة؟|smile
mic|Holding a microphone?|ماسك مايك؟|mic
tie|Wearing a tie or bow tie?|لابس كرافتة أو بيبيون؟|tie
earrings|Wearing earrings?|لابسة حلق؟|earrings
glasses|Wearing glasses or sunglasses?|لابس نضارة؟|glasses
light_hair|Blonde or red hair?|شعرها أشقر أو أحمر؟|light_hair`,
  pharaohs: `
person|Is it a person (pharaoh or queen)?|هل هو شخص (ملك أو ملكة)؟|person
female|Is it a queen or woman?|هل هي ملكة أو ست؟|female
ancient|Is it from ancient Egypt?|من أيام الفراعنة؟|ancient
statue|Is it a statue?|هل هو تمثال؟|statue
headdress|Wearing a crown or headdress?|لابس تاج أو غطاء راس؟|headdress
temple|Is it a temple?|هل هو معبد؟|temple
pyramid|Is it a pyramid?|هل هو هرم؟|pyramid
religious|Is it a mosque, church or monastery?|جامع أو كنيسة أو دير؟|religious
cairo|Is it in Cairo or Giza?|في القاهرة أو الجيزة؟|cairo
upper|Is it in Luxor or Aswan?|في الأقصر أو أسوان؟|upper
desert|Is it in the desert?|في الصحرا؟|desert
water|Can you see the sea or a canal?|فيه بحر أو قناة؟|water
abroad|Is it kept in a museum abroad?|موجود في متحف برا مصر؟|abroad
night|Is the photo taken at night?|الصورة بالليل؟|night
gold|Is it made of gold?|معمول من دهب؟|gold`,
};

const parse = <T>(text: string, f: (cols: string[]) => T): T[] =>
  text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => f(l.split("|").map((c) => c.trim())));

export const GW_CARDS: Record<GwCategory, GwCard[]> = Object.fromEntries(
  GW_CATEGORIES.map((cat) => [cat, parse(DECKS[cat], ([slug, en, ar, tags]) => ({ id: `${cat}/${slug}`, category: cat, en, ar, tags: tags ? tags.split(/\s+/) : [] }))]),
) as Record<GwCategory, GwCard[]>;

export const GW_QUESTIONS: Record<GwCategory, GwQuestion[]> = Object.fromEntries(
  GW_CATEGORIES.map((cat) => [cat, parse(QUESTION_TEXT[cat], ([id, en, ar, tag]) => ({ id: `${cat}:${id}`, category: cat, en, ar, tag }))]),
) as Record<GwCategory, GwQuestion[]>;

const CARD_INDEX = new Map(GW_CATEGORIES.flatMap((c) => GW_CARDS[c]).map((card) => [card.id, card]));
const QUESTION_INDEX = new Map(GW_CATEGORIES.flatMap((c) => GW_QUESTIONS[c]).map((q) => [q.id, q]));

export const cardById = (id: string): GwCard | undefined => CARD_INDEX.get(id);
export const questionById = (id: string): GwQuestion | undefined => QUESTION_INDEX.get(id);
export const cardImage = (id: string) => `/guesswho/${id}.webp`;
/** The server's answer to a ready-made question about a card. */
export const answerFor = (cardId: string, questionId: string): boolean => {
  const card = cardById(cardId);
  const q = questionById(questionId);
  return !!card && !!q && card.tags.includes(q.tag);
};
