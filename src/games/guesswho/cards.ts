/**
 * Guess Who card decks. Every card has a free-licensed photo in
 * /public/guesswho/<category>/<id>.webp (see credits.json) and tags that
 * answer the ready-made yes/no questions. Visual tags (glasses, moustache,
 * black & white…) describe the card's photo, so they were checked against it.
 */

export type GwCategory = "food" | "stars" | "singers" | "footballers" | "pharaohs" | "nature" | "everyday" | "icons";
export const GW_CATEGORIES: GwCategory[] = ["stars", "singers", "footballers", "food", "pharaohs", "nature", "everyday", "icons"];

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
  singers: `
umm_kulthum|Umm Kulthum|أم كلثوم|female earrings bw golden
abdel_halim|Abdel Halim Hafez|عبد الحليم حافظ|smile tie golden
abdel_wahab|Mohamed Abdel Wahab|محمد عبد الوهاب|bw tie golden
farid_atrash|Farid al-Atrash|فريد الأطرش|bw tie golden
shadia|Shadia|شادية|female golden
amr_diab|Amr Diab|عمرو دياب|smile
mohamed_mounir|Mohamed Mounir|محمد منير|curly grey
sherine|Sherine|شيرين|female mic
tamer_hosny|Tamer Hosny|تامر حسني|mic beard moustache smile
angham|Angham|أنغام|female earrings smile
hakim|Hakim|حكيم|smile
wegz|Wegz|ويجز|mic beard moustache rapper
dalida|Dalida|داليدا|female light_hair golden
sayed_darwish|Sayed Darwish|سيد درويش|bw curly moustache golden
warda|Warda|وردة|female earrings golden
najat|Najat Al Saghira|نجاة الصغيرة|female golden
laila_mourad|Laila Mourad|ليلى مراد|female bw smile golden
asmahan|Asmahan|أسمهان|female bw golden
adaweyah|Ahmed Adaweyah|أحمد عدوية|smile
hisham_abbas|Hisham Abbas|هشام عباس|mic
ehab_tawfik|Ehab Tawfik|إيهاب توفيق|mic
ali_haggar|Ali El Haggar|علي الحجار|beard moustache grey smile
hamid_shaeri|Hamid El Shaeri|حميد الشاعري|bw
cairokee|Cairokee|كايروكي|beard moustache
hossam_habib|Hossam Habib|حسام حبيب|
ahmed_mekky|Ahmed Mekky|أحمد مكي|beard moustache mic rapper
karem_mahmoud|Karem Mahmoud|كارم محمود|bw tie golden
faiza_ahmed|Fayza Ahmed|فايزة أحمد|female bw golden
amal_maher|Amal Maher|آمال ماهر|female mic
nesma_mahgoub|Nesma Mahgoub|نسمة محجوب|female mic earrings`,
  footballers: `
mohamed_salah|Mohamed Salah|محمد صلاح|europe premier beard moustache curly jersey
aboutrika|Mohamed Aboutrika|محمد أبو تريكة|ahly jersey
ahmed_hassan|Ahmed Hassan|أحمد حسن|ahly zamalek europe beard moustache
hadary|Essam El Hadary|عصام الحضري|ahly zamalek europe goalkeeper jersey
elneny|Mohamed Elneny|محمد النني|europe premier beard moustache curly jersey
marmoush|Omar Marmoush|عمر مرموش|europe premier beard moustache curly jersey smile
trezeguet|Trezeguet|تريزيجيه|ahly europe premier beard moustache jersey smile
mido|Mido|ميدو|zamalek europe premier beard moustache curly
zidan|Mohamed Zidan|محمد زيدان|europe glasses
khatib|Mahmoud El Khatib|محمود الخطيب|ahly curly jersey
shehata|Hassan Shehata|حسن شحاتة|zamalek grey moustache
wael_gomaa|Wael Gomaa|وائل جمعة|ahly jersey bald
mohamed_barakat|Mohamed Barakat|محمد بركات|ahly
hossam_ghaly|Hossam Ghaly|حسام غالي|ahly europe premier beard moustache curly jersey
ahmed_fathy|Ahmed Fathy|أحمد فتحي|ahly europe premier beard moustache
abou_gabal|Mohamed Abou Gabal|محمد أبو جبل|zamalek goalkeeper beard moustache jersey
abdelmonem|Mohamed Abdelmonem|محمد عبد المنعم|ahly europe beard moustache jersey
mostafa_mohamed|Mostafa Mohamed|مصطفى محمد|zamalek europe jersey
emam_ashour|Emam Ashour|إمام عاشور|ahly zamalek europe jersey
kahraba|Mahmoud Kahraba|محمود كهربا|ahly zamalek europe beard moustache jersey smile
abdallah_said|Abdallah El Said|عبد الله السعيد|ahly zamalek europe beard moustache jersey
elmohamady|Ahmed Elmohamady|أحمد المحمدي|europe premier beard moustache tie
shikabala|Shikabala|شيكابالا|zamalek europe jersey bald
tarek_hamed|Tarek Hamed|طارق حامد|zamalek jersey
sherif_ekramy|Sherif Ekramy|شريف إكرامي|ahly europe goalkeeper curly jersey
shenawy|Mohamed El Shenawy|محمد الشناوي|ahly goalkeeper beard moustache jersey
afsha|Mohamed Magdy Afsha|محمد مجدي أفشة|ahly beard moustache jersey
saleh_selim|Saleh Selim|صالح سليم|ahly europe bw tie
gohary|Mahmoud El-Gohary|محمود الجوهري|ahly bw
omar_gaber|Omar Gaber|عمر جابر|zamalek europe curly jersey
mohamed_sherif|Mohamed Sherif|محمد شريف|ahly smile
hamada_sedki|Hamada Sedki|حمادة صدقي|grey
rami_rabia|Ramy Rabia|رامي ربيعة|ahly europe jersey
ahmed_elshenawy|Ahmed El Shenawy|أحمد الشناوي|zamalek goalkeeper beard moustache jersey`,
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
  nature: `
camel|Camel|جمل|animal four_legs desert farm
crocodile|Nile Crocodile|تمساح النيل|animal reptile dangerous four_legs water sacred
ibis|Sacred Ibis|أبو منجل|animal bird water sacred
egyptian_mau|Egyptian Mau Cat|القطة المصري|animal four_legs farm sacred
donkey|Donkey|حمار|animal four_legs farm
buffalo|Water Buffalo|جاموسة|animal four_legs farm
scarab|Scarab Beetle|الجعران|animal insect sacred
fennec|Fennec Fox|ثعلب الفنك|animal four_legs desert
cobra|Egyptian Cobra|الكوبرا المصرية|animal reptile dangerous desert sacred
scorpion|Scorpion|عقرب|animal insect dangerous desert
lotus|Blue Lotus|اللوتس الأزرق|flower water sacred
papyrus|Papyrus Plant|نبات البردي|water sacred
date_palm|Date Palm|نخلة البلح|fruit eat
mango|Mango|مانجة|fruit eat
guava|Guava|جوافة|fruit eat
dolphin|Dolphin|دولفين|animal sea water
clownfish|Clownfish|سمكة المهرج|animal sea water
sea_turtle|Sea Turtle|سلحفاة بحرية|animal sea water reptile
hoopoe|Hoopoe|هدهد|animal bird
flamingo|Flamingo|فلامينجو|animal bird water
tilapia|Tilapia|سمك بلطي|animal water eat
mongoose|Mongoose|نمس|animal four_legs
jerboa|Jerboa|جربوع|animal desert
egyptian_goose|Egyptian Goose|الإوز المصري|animal bird water
dugong|Dugong|عروس البحر|animal sea water
vulture|Egyptian Vulture|النسر المصري|animal bird desert sacred
falcon|Falcon|صقر|animal bird sacred
cotton|Egyptian Cotton|القطن المصري|flower
pigeon|Pigeon|حمامة|animal bird farm eat
nile_monitor|Nile Monitor|ورل النيل|animal reptile four_legs water
jasmine|Jasmine|ياسمين|flower
watermelon|Watermelon|بطيخ|fruit eat
fig|Fig|تين|fruit eat`,
  everyday: `
felucca|Felucca|فلوكة|ride water wood
fanous|Ramadan Fanous|فانوس رمضان|holiday light handmade
galabeya|Galabeya|جلابية|wear
tawla|Tawla|طاولة|game wood
cairo_metro|Cairo Metro|مترو القاهرة|ride writing
mashrabiya|Mashrabiya|مشربية|wood handmade
oud|Oud|عود|instrument wood handmade
tabla|Tabla|طبلة|instrument
kanun|Qanun|قانون|instrument wood
hantour|Hantour|حنطور|ride
nubian_village|Nubian Music|المزيكا النوبي|person instrument
khayamiya|Khayamiya|الخيامية|handmade
papyrus_paper|Papyrus Paper|ورق البردي|ancient writing
ankh|Ankh|مفتاح الحياة|ancient
hieroglyphs|Hieroglyphs|الهيروغليفية|ancient writing
tuktuk|Tuk-Tuk|توك توك|ride
sham_nessim|Sham El-Nessim Eggs|بيض شم النسيم|holiday
shadoof|Shadoof|شادوف|water wood ancient
water_pipe_ibrik|Ibrik|إبريق|water
kite|Kite|طيارة ورق|game
domino|Dominoes|دومينو|game
tarboosh2|Tarboosh|طربوش|wear
tahtib|Tahtib|التحطيب|person game
zills|Sagat|صاجات|instrument
ney|Ney|ناي|instrument wood
henna|Henna|حنة|person handmade
scarab_amulet|Scarab Amulet|تميمة الجعران|ancient writing wear
cartouche|Cartouche|خرطوش|ancient writing
canopic|Canopic Jars|الأواني الكانوبية|ancient
ushabti|Ushabti|تماثيل الأوشابتي|ancient writing
mosque_lamp|Mosque Lamp|مشكاة|light writing handmade
sistrum|Sistrum|الصلاصل|ancient instrument
senet|Senet|لعبة سنت|ancient game`,
  icons: `
mahfouz|Naguib Mahfouz|نجيب محفوظ|writer nobel glasses grey bw
zewail|Ahmed Zewail|أحمد زويل|scientist nobel glasses tie
magdi_yacoub|Magdi Yacoub|مجدي يعقوب|scientist smile tie grey
taha_hussein|Taha Hussein|طه حسين|writer old glasses bw tie
farouk_elbaz|Farouk El-Baz|فاروق الباز|scientist glasses smile tie grey
mostafa_mahmoud|Mostafa Mahmoud|مصطفى محمود|writer scientist bw tie
nawal_saadawi|Nawal El Saadawi|نوال السعداوي|female writer scientist grey smile
ahmed_shawqi|Ahmed Shawqi|أحمد شوقي|poet writer old bw moustache tie
hafez_ibrahim|Hafez Ibrahim|حافظ إبراهيم|poet writer old bw hat moustache
akkad|Abbas el-Akkad|عباس العقاد|writer old bw moustache tie
tawfiq_hakim|Tawfiq al-Hakim|توفيق الحكيم|writer old hat moustache grey
salah_jahin|Salah Jahin|صلاح جاهين|poet writer glasses drawing
anis_mansour|Anis Mansour|أنيس منصور|writer glasses smile drawing grey
yusuf_idris|Yusuf Idris|يوسف إدريس|writer scientist bw grey tie
heikal|Mohamed Hassanein Heikal|محمد حسنين هيكل|writer tie smile
zahi_hawass|Zahi Hawass|زاهي حواس|scientist hat grey smile
boutros_ghali|Boutros Boutros-Ghali|بطرس بطرس غالي|glasses grey tie
mostafa_elsayed|Mostafa El-Sayed|مصطفى السيد|scientist moustache smile grey tie
tahtawi|Rifa'a al-Tahtawi|رفاعة الطهطاوي|writer old beard moustache hat drawing
sameera_moussa|Sameera Moussa|سميرة موسى|female scientist smile
hoda_shaarawi|Huda Sha'arawi|هدى شعراوي|female old bw
mahmoud_mokhtar|Mahmoud Mokhtar|محمود مختار|old hat bw
hassan_fathy|Hassan Fathy|حسن فتحي|scientist bw grey
bint_shati|Bint al-Shati|بنت الشاطئ|female writer bw
latifa_zayyat|Latifa al-Zayyat|لطيفة الزيات|female writer bw
abnudi|Abdel Rahman el-Abnudi|عبد الرحمن الأبنودي|poet writer grey moustache
ghitani|Gamal el-Ghitani|جمال الغيطاني|writer grey
ahmed_rami|Ahmed Rami|أحمد رامي|poet writer old drawing
bayram|Bayram al-Tunisi|بيرم التونسي|poet writer old bw
mosharafa|Ali Moustafa Mosharafa|علي مصطفى مشرفة|scientist old glasses moustache bw tie
nabawiya_musa|Nabawiyya Musa|نبوية موسى|female writer old bw tie`,
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
mic|Is there a microphone in the photo?|فيه مايك في الصورة؟|mic
earrings|Wearing earrings?|لابسة حلق؟|earrings
hat|Wearing a hat or cap?|لابس كاب أو برنيطة؟|hat
comedian|Famous for comedy?|مشهور بالكوميديا؟|comedian`,
  singers: `
female|Is it a woman?|هل هي ست؟|female
golden|A golden-era star (1920s–60s)?|من نجوم الزمن الجميل؟|golden
bw|Is it a black & white photo?|الصورة أبيض وأسود؟|bw
smile|Smiling with teeth showing?|بيضحك وسنانه باينة؟|smile
moustache|Has a moustache?|عنده شنب؟|moustache
beard|Has a beard?|عنده دقن؟|beard
curly|Curly hair?|شعره كيرلي؟|curly
grey|Grey or white hair?|شعره أبيض أو رمادي؟|grey
mic|Is there a microphone in the photo?|فيه مايك في الصورة؟|mic
tie|Wearing a tie or bow tie?|لابس كرافتة أو بيبيون؟|tie
earrings|Wearing earrings?|لابسة حلق؟|earrings
light_hair|Blonde or red hair?|شعرها أشقر أو أحمر؟|light_hair
rapper|Is it a rapper?|هل هو مغني راب؟|rapper`,
  footballers: `
ahly|Played for Al Ahly?|لعب للأهلي؟|ahly
zamalek|Played for Zamalek?|لعب للزمالك؟|zamalek
europe|Played for a club in Europe?|لعب في نادي أوروبي؟|europe
premier|Played in England's Premier League?|لعب في الدوري الإنجليزي؟|premier
goalkeeper|Is it a goalkeeper?|هل هو حارس مرمى؟|goalkeeper
jersey|Wearing a football shirt?|لابس تيشيرت كورة؟|jersey
beard|Has a beard?|عنده دقن؟|beard
moustache|Has a moustache?|عنده شنب؟|moustache
curly|Curly hair?|شعره كيرلي؟|curly
bald|Bald or shaved head?|راسه أقرع أو محلوقة؟|bald
grey|Grey or white hair?|شعره أبيض أو رمادي؟|grey
smile|Smiling with teeth showing?|بيضحك وسنانه باينة؟|smile
bw|Is it a black & white photo?|الصورة أبيض وأسود؟|bw
tie|Wearing a tie?|لابس كرافتة؟|tie
glasses|Wearing glasses or sunglasses?|لابس نضارة؟|glasses`,
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
  nature: `
animal|Is it an animal?|هل هو حيوان؟|animal
bird|Is it a bird?|هل هو طير؟|bird
reptile|Is it a reptile (snake, crocodile, turtle…)?|من الزواحف؟|reptile
insect|Is it a bug or insect?|حشرة؟|insect
four_legs|Does it walk on four legs?|بيمشي على أربع رجلين؟|four_legs
water|Does it live in or by the water?|عايش في الميه أو جنبها؟|water
sea|Does it live in the Red Sea?|عايش في البحر الأحمر؟|sea
desert|Does it live in the desert?|عايش في الصحرا؟|desert
dangerous|Can it be dangerous?|ممكن يكون خطير؟|dangerous
farm|Is it a farm animal or pet?|حيوان مزرعة أو أليف؟|farm
sacred|Sacred to the ancient Egyptians?|كان مقدس عند الفراعنة؟|sacred
fruit|Is it a fruit?|هل هي فاكهة؟|fruit
flower|Is it a flower?|هل هي وردة؟|flower
eat|Do people eat it?|الناس بتاكله؟|eat`,
  everyday: `
ancient|Is it from ancient Egypt?|من أيام الفراعنة؟|ancient
instrument|Is it a musical instrument?|آلة موسيقية؟|instrument
game|Is it a game you play?|لعبة بتتلعب؟|game
ride|Can you ride in it?|ممكن تركبه؟|ride
wear|Is it something you wear?|حاجة بتتلبس؟|wear
holiday|Linked to Ramadan or a holiday?|مرتبط برمضان أو عيد؟|holiday
light|Does it give light?|بينور؟|light
handmade|Is it a handmade craft?|شغل يدوي؟|handmade
writing|Has writing or symbols on it?|عليه كتابة أو رموز؟|writing
water|Is it used on or with water?|بيتستخدم مع الميه؟|water
wood|Is it made of wood?|معمول من خشب؟|wood
person|Are there people in the photo?|فيه ناس في الصورة؟|person`,
  icons: `
female|Is it a woman?|هل هي ست؟|female
writer|Is it a writer or poet?|كاتب أو شاعر؟|writer
poet|Is it a poet?|شاعر؟|poet
scientist|Scientist, doctor or engineer?|عالم أو دكتور أو مهندس؟|scientist
nobel|Won a Nobel Prize?|خد جايزة نوبل؟|nobel
old|Born before 1900?|اتولد قبل ١٩٠٠؟|old
bw|Is it a black & white photo?|الصورة أبيض وأسود؟|bw
drawing|Is it a drawing, not a photo?|رسمة مش صورة؟|drawing
glasses|Wearing glasses?|لابس نضارة؟|glasses
moustache|Has a moustache?|عنده شنب؟|moustache
beard|Has a beard?|عنده دقن؟|beard
grey|Grey or white hair?|شعره أبيض أو رمادي؟|grey
smile|Smiling with teeth showing?|بيضحك وسنانه باينة؟|smile
tie|Wearing a tie or bow tie?|لابس كرافتة أو بيبيون؟|tie
hat|Wearing a hat, fez or turban?|لابس برنيطة أو طربوش أو عمة؟|hat`,
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

/** Cards saved before "Singers & Footballers" was split into two decks. */
function legacyId(id: string): string {
  if (!id.startsWith("music_sport/")) return id;
  const slug = id.slice("music_sport/".length);
  return CARD_INDEX.has(`singers/${slug}`) ? `singers/${slug}` : `footballers/${slug}`;
}

export const cardById = (id: string): GwCard | undefined => CARD_INDEX.get(id) ?? CARD_INDEX.get(legacyId(id));
export const questionById = (id: string): GwQuestion | undefined => QUESTION_INDEX.get(id);
export const cardImage = (id: string) => `/guesswho/${legacyId(id)}.webp`;
/** The server's answer to a ready-made question about a card. */
export const answerFor = (cardId: string, questionId: string): boolean => {
  const card = cardById(cardId);
  const q = questionById(questionId);
  return !!card && !!q && card.tags.includes(q.tag);
};
