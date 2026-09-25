import type { Lang } from "@/lib/i18n/dictionaries";

/** Beginner guides: short pages that each fit one phone screen (no scrolling). */

export type GuideGame = "shut10" | "hangman" | "guesswho" | "connect4";

export interface GuideItem {
  term?: string;
  text: string;
}
export interface GuidePage {
  icon: string;
  title: string;
  items: GuideItem[];
}

export const GUIDES: Record<GuideGame, Record<Lang, GuidePage[]>> = {
  shut10: {
    en: [
      {
        icon: "🎯",
        title: "The goal",
        items: [
          { text: "Your board has tiles 1 to 10, all open." },
          { text: "Roll two dice, then close open tiles that add up to the total — a roll of 8 can close 8, or 5 + 3, or 1 + 2 + 5." },
          { text: "When no open tiles can make your roll, you're blocked." },
          { text: "Your score is the sum of the tiles still open. Lower is better — close them all to SHUT THE BOX and score 0!" },
        ],
      },
      {
        icon: "🎲",
        title: "Game modes",
        items: [
          { term: "Face Off", text: "Players take turns and the dice pass after every roll. Closest to the table game." },
          { term: "Classic", text: "Keep rolling until you're blocked, then the next player plays their board." },
          { term: "Race", text: "Everyone rolls at the same time on their own board. First to shut the box wins." },
          { term: "Tournament", text: "Face Off rounds with a points leaderboard after each round." },
        ],
      },
      {
        icon: "🏆",
        title: "Rounds & scoring",
        items: [
          { term: "Rounds", text: "One round; Best of 3/5/7 (win most rounds); First to 3/5 (first to that many wins); Custom (exact number); Endless (until the host stops)." },
          { term: "Round wins", text: "Whoever wins the most rounds wins the match." },
          { term: "Match points", text: "Points for your place each round (with 4 players: 3, 2, 1, 0)." },
          { term: "Lowest total", text: "Every round's open-tile score is added up. Lowest total wins." },
        ],
      },
      {
        icon: "⚙️",
        title: "Rules",
        items: [
          { term: "Extra roll on doubles", text: "Roll a double (like 4 + 4) and you roll again." },
          { term: "Hints", text: "Off · Limited (3 per round, shows the best move) · On (unlimited) · Kids (always highlights tiles you can use)." },
          { term: "Roll & move timers", text: "Seconds to roll and to choose tiles. If time runs out, the game rolls or picks for you. No timer = take your time." },
          { term: "Spectators", text: "Let friends watch the game without playing." },
        ],
      },
      {
        icon: "🧩",
        title: "More options",
        items: [
          { term: "One-die endgame", text: "Once the big tiles are closed (7 and up, or 6 / 8), you may roll a single die." },
          { term: "Disconnects", text: "If someone drops on their turn: wait 30 s then skip, skip at once, or block them for the round." },
          { term: "Ties", text: "Fewest tiles left wins, or tiles then a dice roll-off, or share the win." },
          { term: "First player", text: "Rotate every round, or pick at random." },
        ],
      },
      {
        icon: "💡",
        title: "Tips",
        items: [
          { text: "Close the big tiles (7, 8, 9, 10) early — they are the hardest to close later." },
          { text: "Practice has a trainer that shows the best move after each turn." },
          { text: "Invite friends with the room code, link or QR code — or add bots to fill empty seats." },
        ],
      },
    ],
    ar: [
      {
        icon: "🎯",
        title: "الهدف",
        items: [
          { text: "لوحتك فيها الأرقام من ١ لـ ١٠ كلها مفتوحة." },
          { text: "ارمِ زهرين، واقفل أرقام مفتوحة مجموعها يساوي الرمية — رمية ٨ تقفل ٨، أو ٥ + ٣، أو ١ + ٢ + ٥." },
          { text: "لو مفيش أرقام مفتوحة تعمل رقم رميتك، بتتقفل عليك." },
          { text: "نتيجتك = مجموع الأرقام اللي لسه مفتوحة. الأقل أحسن — اقفلها كلها تبقى «أغلقت الصندوق» ونتيجتك صفر!" },
        ],
      },
      {
        icon: "🎲",
        title: "أنماط اللعب",
        items: [
          { term: "مواجهة", text: "اللاعبين بيلعبوا بالدور والزهر بيتنقل بعد كل رمية. الأقرب للعبة الأصلية." },
          { term: "كلاسيكي", text: "فضل ارمي لحد ما تتقفل، وبعدين اللي بعدك يلعب على لوحته." },
          { term: "سباق", text: "الكل بيرمي في نفس الوقت على لوحته. أول واحد يقفل الصندوق يكسب." },
          { term: "بطولة", text: "جولات مواجهة مع جدول نقاط بعد كل جولة." },
        ],
      },
      {
        icon: "🏆",
        title: "الجولات والحساب",
        items: [
          { term: "الجولات", text: "جولة واحدة؛ الأفضل من ٣/٥/٧ (اكسب أغلب الجولات)؛ أول من يصل لـ ٣/٥؛ مخصص (عدد محدد)؛ بلا نهاية (لحد ما المضيف يوقف)." },
          { term: "عدد الجولات", text: "اللي يكسب جولات أكتر يكسب الماتش." },
          { term: "نقاط المباراة", text: "نقاط حسب ترتيبك في كل جولة (مع ٤ لاعبين: ٣، ٢، ١، ٠)." },
          { term: "أقل مجموع", text: "بتتجمع نتيجة كل الجولات، والأقل يكسب." },
        ],
      },
      {
        icon: "⚙️",
        title: "القواعد",
        items: [
          { term: "رمية إضافية عند الزوج", text: "لو جبت زوج (زي ٤ + ٤) بترمي تاني." },
          { term: "التلميحات", text: "إيقاف · محدودة (٣ في الجولة وبتوريك أحسن حركة) · تشغيل (بلا حدود) · للأطفال (بتنوّر الأرقام اللي ينفع تستخدمها دايمًا)." },
          { term: "مؤقت الرمي والاختيار", text: "ثواني للرمي ولاختيار الأرقام. لو الوقت خلص اللعبة بترمي أو تختار بدالك. بدون مؤقت = براحتك." },
          { term: "المتفرجون", text: "صحابك يقدروا يتفرجوا من غير ما يلعبوا." },
        ],
      },
      {
        icon: "🧩",
        title: "خيارات أكتر",
        items: [
          { term: "نرد واحد في النهاية", text: "لما الأرقام الكبيرة تتقفل (٧ وأكبر، أو ٦ / ٨) تقدر ترمي زهر واحد." },
          { term: "انقطاع الاتصال", text: "لو حد فصل في دوره: استنى ٣٠ ثانية وتخطّى، أو تخطّى على طول، أو احجبه للجولة." },
          { term: "التعادل", text: "الأقل في عدد الأرقام يكسب، أو الأرقام وبعدين رمية فاصلة، أو فوز مشترك." },
          { term: "اللاعب الأول", text: "بالتناوب كل جولة، أو عشوائي." },
        ],
      },
      {
        icon: "💡",
        title: "نصايح",
        items: [
          { text: "اقفل الأرقام الكبيرة (٧، ٨، ٩، ١٠) بدري — دي أصعب حاجة تتقفل بعدين." },
          { text: "التدريب فيه مدرب بيوريك أحسن حركة بعد كل دور." },
          { text: "ادعي صحابك بكود الغرفة أو اللينك أو QR — أو ضيف روبوتات تكمّل الأماكن." },
        ],
      },
    ],
  },
  hangman: {
    en: [
      {
        icon: "🎯",
        title: "The goal",
        items: [
          { text: "Find the secret word before the chalk man is fully drawn." },
          { text: "Tap letters on the keyboard. A right letter appears in every place it belongs; a wrong letter draws one more part of the man." },
          { text: "Know the word? Tap SOLVE and type it (a wrong solve also costs a life)." },
        ],
      },
      {
        icon: "✍️",
        title: "Game modes",
        items: [
          { term: "Word master", text: "Players take turns being the master: they pick the secret word (or a random one) and everyone else guesses on one shared board, one letter per turn." },
          { term: "Scoring", text: "+1 for each letter you reveal, +3 (plus hidden letters) for solving. The master scores 5 if the guessers are hanged." },
          { term: "Race", text: "Everyone gets the same word on their own private board at the same time. The first solvers score 3, 2, then 1." },
        ],
      },
      {
        icon: "⚙️",
        title: "Settings",
        items: [
          { term: "Language", text: "English or Arabic words and keyboard." },
          { term: "Category", text: "Animals, countries, food, sports, jobs, home, nature — or mixed." },
          { term: "Rounds", text: "Word master: each player is master 1–3 times. Race: 3, 5, 7 or 10 words." },
          { term: "Lives", text: "6 mistakes (classic) or 9 (easier)." },
          { term: "Timers", text: "Word master: seconds per guess. Race: time for the whole word. Or no timer." },
        ],
      },
      {
        icon: "💡",
        title: "Tips",
        items: [
          { text: "Start with common letters: E, A, O, T in English — ا، ل، م، ي in Arabic." },
          { text: "In Arabic, أ إ آ all count as ا, and ة counts as ه when you solve." },
          { text: "Practice lets you play alone with the same words." },
        ],
      },
    ],
    ar: [
      {
        icon: "🎯",
        title: "الهدف",
        items: [
          { text: "اعرف الكلمة السرية قبل ما رسمة الراجل بالطباشير تكمل." },
          { text: "دوس على الحروف. الحرف الصح بيظهر في كل مكانه؛ والحرف الغلط بيرسم جزء زيادة من الراجل." },
          { text: "عرفت الكلمة؟ دوس «حل» واكتبها (الحل الغلط برضه بيخسّرك محاولة)." },
        ],
      },
      {
        icon: "✍️",
        title: "أنماط اللعب",
        items: [
          { term: "صاحب الكلمة", text: "كل لاعب بدوره يبقى صاحب الكلمة: يختار كلمة سرية (أو عشوائية) والباقي يخمّنوا على لوحة واحدة، حرف في كل دور." },
          { term: "الحساب", text: "+١ لكل حرف تكشفه، +٣ (وزيادة الحروف المخفية) لو حليت. صاحب الكلمة ياخد ٥ لو اتشنقوا." },
          { term: "سباق", text: "الكل بياخد نفس الكلمة على لوحته الخاصة في نفس الوقت. أول اللي يحلوا ياخدوا ٣، ٢، وبعدين ١." },
        ],
      },
      {
        icon: "⚙️",
        title: "الإعدادات",
        items: [
          { term: "اللغة", text: "كلمات وكيبورد بالإنجليزي أو بالعربي." },
          { term: "الفئة", text: "حيوانات، بلاد، أكل، رياضة، مهن، البيت، طبيعة — أو مشكّل." },
          { term: "الجولات", text: "صاحب الكلمة: كل لاعب يبقى صاحب الكلمة ١–٣ مرات. السباق: ٣ أو ٥ أو ٧ أو ١٠ كلمات." },
          { term: "المحاولات", text: "٦ أخطاء (كلاسيكي) أو ٩ (أسهل)." },
          { term: "المؤقت", text: "صاحب الكلمة: ثواني لكل تخمين. السباق: وقت للكلمة كلها. أو بدون مؤقت." },
        ],
      },
      {
        icon: "💡",
        title: "نصايح",
        items: [
          { text: "ابدأ بالحروف المشهورة: ا، ل، م، ي بالعربي — E، A، O، T بالإنجليزي." },
          { text: "في العربي أ إ آ كلهم بيتحسبوا ا، والـ ة بتتحسب ه وانت بتحل." },
          { text: "التدريب بيخليك تلعب لوحدك بنفس الكلمات." },
        ],
      },
    ],
  },
  guesswho: {
    en: [
      {
        icon: "🎯",
        title: "The goal",
        items: [
          { text: "Two players share the same board of cards. Each of you secretly gets one card from it." },
          { text: "Ask yes / no questions to work out your rival's card — and guess it before they guess yours!" },
          { text: "Only you can see your own card (bottom corner). Tap it to see it big." },
        ],
      },
      {
        icon: "❓",
        title: "Your turn",
        items: [
          { term: "ASK", text: "Pick a ready-made question — the game answers instantly and always honestly. Or type your own; your rival taps YES or NO." },
          { term: "One question per turn", text: "After the answer, the turn passes to your rival." },
          { term: "Flip", text: "Tap a card to flip down people it can't be. “Flip N ✓” flips every card your answers ruled out." },
          { term: "GUESS", text: "Sure? Tap GUESS, then the card." },
        ],
      },
      {
        icon: "⚙️",
        title: "Settings",
        items: [
          { term: "Deck", text: "Movie stars, singers, footballers, food, pharaohs & landmarks, animals & nature, Egyptian life & things, or great minds." },
          { term: "Cards on the board", text: "16, 20 or 24 — fewer cards make quicker games." },
          { term: "Match", text: "One round, or best of 3 / 5." },
          { term: "Turn timer", text: "30, 60 or 90 seconds per turn — or none." },
        ],
      },
      {
        icon: "🧩",
        title: "More settings",
        items: [
          { term: "Typed questions", text: "Allow players to ask anything they like (answered by the rival). Off = ready-made questions only." },
          { term: "Wrong guess loses", text: "On (classic): a wrong guess loses the round. Off: it just ends your turn and flips that card." },
          { term: "Spectators", text: "Let friends watch the duel." },
        ],
      },
      {
        icon: "💡",
        title: "Tips",
        items: [
          { text: "The best questions split the board in half (“Is it a woman?”)." },
          { text: "Typed questions are fun for things photos can't show (“Did he act in a Ramadan series?”)." },
          { text: "Play VS BOT to practise — the bot answers ready-made questions only." },
          { text: "Forgot an answer? Open 📜 to see every question so far." },
        ],
      },
    ],
    ar: [
      {
        icon: "🎯",
        title: "الهدف",
        items: [
          { text: "لاعبين على نفس لوحة الكروت. كل واحد بياخد كارت سري منها." },
          { text: "اسأل أسئلة إجابتها «آه» أو «لأ» عشان تعرف كارت منافسك — وخمّنه قبل ما يخمّن كارتك!" },
          { text: "انت بس اللي شايف كارتك (في الركن تحت). دوس عليه تشوفه كبير." },
        ],
      },
      {
        icon: "❓",
        title: "دورك",
        items: [
          { term: "اسأل", text: "اختار سؤال جاهز — اللعبة بترد فورًا وبصراحة دايمًا. أو اكتب سؤالك؛ ومنافسك يدوس آه أو لأ." },
          { term: "سؤال واحد في الدور", text: "بعد الإجابة الدور بيروح لمنافسك." },
          { term: "اقلب", text: "دوس على الكارت عشان تقلب اللي مستحيل يكونوا هم. «اقلب N ✓» بيقلب كل الكروت اللي إجاباتك استبعدتها." },
          { term: "خمّن", text: "متأكد؟ دوس «خمّن» وبعدين الكارت." },
        ],
      },
      {
        icon: "⚙️",
        title: "الإعدادات",
        items: [
          { term: "المجموعة", text: "نجوم السينما، مطربين، لاعيبة كورة، أكل، فراعنة ومعالم، حيوانات وطبيعة، حاجات مصرية، أو عقول مصرية." },
          { term: "عدد الكروت", text: "١٦ أو ٢٠ أو ٢٤ — كروت أقل = لعب أسرع." },
          { term: "المباراة", text: "جولة واحدة، أو الأفضل من ٣ / ٥." },
          { term: "وقت الدور", text: "٣٠ أو ٦٠ أو ٩٠ ثانية للدور — أو من غير وقت." },
        ],
      },
      {
        icon: "🧩",
        title: "إعدادات أكتر",
        items: [
          { term: "كتابة أسئلة", text: "اللاعبين يقدروا يسألوا أي حاجة (ومنافسهم يرد). مقفولة = أسئلة جاهزة بس." },
          { term: "التخمين الغلط يخسّر", text: "مفتوحة (كلاسيكي): التخمين الغلط يخسّرك الجولة. مقفولة: بيخلص دورك ويتقلب الكارت ده بس." },
          { term: "المتفرجون", text: "صحابك يقدروا يتفرجوا على المبارزة." },
        ],
      },
      {
        icon: "💡",
        title: "نصايح",
        items: [
          { text: "أحسن سؤال هو اللي يقسم اللوحة نصين («هل هي ست؟»)." },
          { text: "الأسئلة المكتوبة حلوة للحاجات اللي الصورة مش بتبينها («مثّل في مسلسل رمضان؟»)." },
          { text: "العب «ضد الروبوت» عشان تتمرن — الروبوت بيرد على الأسئلة الجاهزة بس." },
          { text: "نسيت إجابة؟ افتح 📜 تشوف كل الأسئلة اللي فاتت." },
        ],
      },
    ],
  },
  connect4: {
    en: [
      {
        icon: "🎯",
        title: "The goal",
        items: [
          { text: "Two players, red and yellow, take turns dropping discs into the board." },
          { text: "A disc falls to the lowest empty hole of the column you pick." },
          { text: "First to line up 4 of their discs in a row wins the round — across, up and down, or diagonally." },
          { text: "If the board fills up with no line, the round is a draw." },
        ],
      },
      {
        icon: "👆",
        title: "Your turn",
        items: [
          { term: "Drop", text: "Tap any column. On a computer, hover to see where the disc will land." },
          { term: "Winning line", text: "When someone connects, the winning discs light up and are joined by a golden line." },
          { term: "New round", text: "The slider opens and every disc drops out of the board — just like the real one." },
        ],
      },
      {
        icon: "🎲",
        title: "Game modes",
        items: [
          { term: "Classic", text: "Only drops. The original game." },
          { term: "PopOut", text: "On your turn you may pop one of YOUR discs out of the bottom instead of dropping; everything above slides down. If a pop makes a line for both players, the one who popped wins." },
        ],
      },
      {
        icon: "⚙️",
        title: "Settings",
        items: [
          { term: "Board size", text: "7 × 6 (classic), 8 × 7 or 9 × 7 for longer games." },
          { term: "Discs in a row", text: "Connect 4, or 5 for a harder challenge on bigger boards." },
          { term: "Match", text: "One round, or best of 3 / 5. Draws are replayed." },
          { term: "Turn timer", text: "10, 20 or 30 seconds — if time runs out a move is played for you. Or no timer." },
          { term: "Who opens", text: "Take turns, the loser of the last round, or random." },
        ],
      },
      {
        icon: "💡",
        title: "Tips",
        items: [
          { text: "The middle column is the strongest — it's part of the most possible lines." },
          { text: "Always check if your rival has three in a row with a free spot. Block it!" },
          { text: "Try to make two threats at once — they can only block one." },
          { text: "Practise VS BOT: easy, normal or hard." },
        ],
      },
    ],
    ar: [
      {
        icon: "🎯",
        title: "الهدف",
        items: [
          { text: "لاعبين، أحمر وأصفر، كل واحد بدوره بينزّل قرص في اللوحة." },
          { text: "القرص بيقع لآخر خانة فاضية تحت في العمود اللي تختاره." },
          { text: "أول واحد يعمل ٤ أقراص في صف يكسب الجولة — بالعرض أو بالطول أو بالمايل." },
          { text: "لو اللوحة اتملت ومفيش صف، الجولة تعادل." },
        ],
      },
      {
        icon: "👆",
        title: "دورك",
        items: [
          { term: "نزّل", text: "دوس على أي عمود. على الكمبيوتر، حرّك الماوس عشان تشوف القرص هيقع فين." },
          { term: "صف الفوز", text: "لما حد يكسب، أقراص الفوز بتنوّر ويتوصلوا بخط دهبي." },
          { term: "جولة جديدة", text: "الشريحة بتتفتح وكل الأقراص بتقع من تحت — زي اللعبة الحقيقية بالظبط." },
        ],
      },
      {
        icon: "🎲",
        title: "أنماط اللعب",
        items: [
          { term: "كلاسيكي", text: "تنزيل بس. اللعبة الأصلية." },
          { term: "بوب أوت", text: "في دورك تقدر تطلّع قرص من أقراصك انت من تحت بدل ما تنزّل؛ واللي فوقه كله بينزل. لو التطليع عمل صف للاتنين، اللي طلّع هو اللي يكسب." },
        ],
      },
      {
        icon: "⚙️",
        title: "الإعدادات",
        items: [
          { term: "حجم اللوحة", text: "٧ × ٦ (الكلاسيكي)، أو ٨ × ٧ أو ٩ × ٧ للعب أطول." },
          { term: "عدد الأقراص في الصف", text: "٤، أو ٥ لتحدي أصعب على اللوحات الكبيرة." },
          { term: "المباراة", text: "جولة واحدة، أو الأفضل من ٣ / ٥. التعادل بيتعاد." },
          { term: "وقت الدور", text: "١٠ أو ٢٠ أو ٣٠ ثانية — لو الوقت خلص بتتلعب حركة بدالك. أو من غير وقت." },
          { term: "مين يبدأ", text: "بالتبادل، أو اللي خسر الجولة اللي فاتت، أو عشوائي." },
        ],
      },
      {
        icon: "💡",
        title: "نصايح",
        items: [
          { text: "العمود اللي في النص هو الأقوى — داخل في أكتر صفوف ممكنة." },
          { text: "دايمًا بص لو منافسك عنده ٣ في صف وجنبهم خانة فاضية. اقفلها!" },
          { text: "حاول تعمل تهديدين في نفس الوقت — هيقدر يقفل واحد بس." },
          { text: "اتمرن «ضد الروبوت»: سهل أو عادي أو صعب." },
        ],
      },
    ],
  },
};
