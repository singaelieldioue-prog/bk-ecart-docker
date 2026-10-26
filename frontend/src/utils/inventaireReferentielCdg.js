// Référentiel « Inventaire » du CDG — table reproduite cellule pour cellule de la feuille
// « Inventaire initial » du classeur de référence du CDG (exact/suivis stock BK 1.xlsx,
// relevé du 26/10/2026) : les 316 articles suivis au stock, leur catégorie, leur marque
// (Frns), leur COLISAGE (colonne E), leur « Nb articles / inner » (F), leur unité affichée (K) et
// leur prix unitaire de valorisation (L), ligne à ligne et dans l'ordre du classeur du CDG.
// Un champ absent = cellule vide chez le CDG (ex. 24 lignes sans colisage : produits pesés en
// kilogrammes ou « Unités »).
// Demande du 26/10/2026 : « je produis tout pareil pour notre fichier suivi de stock,
// conditionnement pareil et tout ».
export const INVENTAIRE_REFERENTIEL_CDG = [
  { cat: "Boissons", frns: "SIA", nom: "CAFE EN GRAINS 250 g", cond: 1, unite: "Inner de 250 g", pu: 3432 },  // L7
  { cat: "Boissons", frns: "SIA", nom: "PRESSEA - Ananas 200ML", cond: 24, unite: "Carton de 24", pu: 3050.8474576271187 },  // L8
  { cat: "Boissons", frns: "SIA", nom: "PRESSEA - Orange 200ML", cond: 24, unite: "Carton de 24", pu: 3050.8474576271187 },  // L9
  { cat: "Boissons", frns: "SIA", nom: "PRESSEA - Pomme 200ML", cond: 24, unite: "Carton de 24", pu: 3050.8474576271187 },  // L10
  { cat: "Boissons", frns: "SIA", nom: "PRESSEA - Cocktail 200ML", cond: 24, unite: "Carton de 24", pu: 3050.8474576271187 },  // L11
  { cat: "Boissons", frns: "SIA", nom: "PRESSEA - Goyave 200ML", cond: 24, unite: "Carton de 24", pu: 3050.8474576271187 },  // L12
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE COCA COLA 50cL", cond: 6, unite: "Pack de 6", pu: 1449.1525423728815 },  // L13
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE COCA COLA 1.5L", cond: 6, unite: "Pack de 6", pu: 0 },  // L14
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE COCA COLA ZERO 50cL", cond: 6, unite: "Pack de 6", pu: 1449.1525423728815 },  // L15
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE COCA COLA 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L16
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE COCA COLA ZERO 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L17
  { cat: "Boissons", frns: "SIA", nom: "EAU", cond: 9, unite: "Pack de 9", pu: 724.5762711864407 },  // L18
  { cat: "Boissons", frns: "SIA", nom: "EAU KIRENE 50cl 12", cond: 12, unite: "Pack de 12", pu: 950 },  // L19
  { cat: "Boissons", frns: "SIA", nom: "EAU KIRENE 50cl", cond: 16, unite: "Pack de 16", pu: 1250 },  // L20
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA 50cL", cond: 6, unite: "Pack de 6", pu: 1524 },  // L21
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA 1.5L", cond: 6, unite: "Pack de 6", pu: 0 },  // L22
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L23
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA COCKTAIL 30cL", cond: 12, unite: "Pack de 12", pu: 1529.6610169491526 },  // L24
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA ANANAS 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L25
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA FRUITS ROUGES 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L26
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE FANTA POMME 30cL", cond: 12, unite: "Pack de 12", pu: 1409.322033898305 },  // L27
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE SCHWEPPES AGRUMES 30cL", cond: 12, unite: "Pack de 12", pu: 1690.677966101695 },  // L28
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE MIRINDA ORANGE 30 CL", cond: 12, unite: "Pack de 12", pu: 1520 },  // L29
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE PEPSI ZERO 30CL", cond: 12, unite: "Pack de 12", pu: 1520 },  // L30
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE PEPSI 30CL", cond: 12, unite: "Pack de 12", pu: 1805 },  // L31
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE MIRINDA FRUIT ROUGE 30 CL", cond: 12, unite: "Pack de 12", pu: 1520 },  // L32
  { cat: "Boissons", frns: "SIA", nom: "7 UP 30 CL", cond: 12, unite: "Pack de 12", pu: 1520 },  // L33
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE PEPSI 1,5L", cond: 6, unite: "Pack de 6", pu: 3151 },  // L34
  { cat: "Boissons", frns: "SIA", nom: "CAN PEPSI 250 ml", cond: 24, unite: "Pack de 24", pu: 1530 },  // L35
  { cat: "Boissons", frns: "SIA", nom: "CANETTE PEPSI ZERO 25 CL", cond: 24, unite: "Pack de 25", pu: 1530 },  // L36
  { cat: "Boissons", frns: "SIA", nom: "BIERE BEAUFORT 33cl", cond: 24, unite: "Pack de 24", pu: 7950 },  // L37
  { cat: "Boissons", frns: "SIA", nom: "BIERE BOCK 33cl", cond: 24, unite: "Pack de 24", pu: 6000 },  // L38
  { cat: "Boissons", frns: "SIA", nom: "BIERE BOCK 50cl", cond: 24, unite: "Pack de 24", pu: 8262.71186440678 },  // L39
  { cat: "Boissons", frns: "SIA", nom: "MILO", cond: 300, unite: "Sachet individuel", pu: 105.93 },  // L40
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE SPRITE 50cL", cond: 6, unite: "Pack de 6", pu: 1524 },  // L41
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE SPRITE 1.5L", cond: 6, unite: "Pack de 6", pu: 0 },  // L42
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE SPRITE 30cL", cond: 12, unite: "Pack de 12", pu: 1524 },  // L43
  { cat: "Boissons", frns: "SIA", nom: "BOUTEILLE ORANGINA 50cL", cond: 6, unite: "Pack de 6", pu: 2033.898305084746 },  // L44
  { cat: "Boissons", frns: "SIA", nom: "ORANGINA 33CL", cond: 24, unite: "Pack de 24", pu: 6406.77966101695 },  // L45
  { cat: "Boissons", frns: "SIA", nom: "THE", cond: 25, unite: "Sachet individuel", pu: 29.322 },  // L46
  { cat: "Boissons", frns: "SIA", nom: "LAIT en Brique", cond: 12, unite: "Pack de 12*1L", pu: 10944 },  // L47
  { cat: "Boissons", frns: "SIA", nom: "LAIT en brique - PROSUMA", cond: 12, unite: "Pack de 12*1L", pu: 10238.53211 },  // L48
  { cat: "Boissons", frns: "SIA", nom: "LAIT en brique - PROSUMA_06", cond: 6, unite: "Pack de 6*1L", pu: 5548.6238532 },  // L49
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHICKEN WINGS", cond: 330, inner: 66, unite: "Carton", pu: 59744.56356000001 },  // L50
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHICKEN WINGS - CAIRO", cond: 340, inner: 68, unite: "Carton", pu: 33876.35730433728 },  // L51
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHICKEN WHOPPER GRILLED", cond: 67, unite: "Carton", pu: 55196.693329943686 },  // L52
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHILI CHEESE BITES", cond: 300, inner: 50, unite: "Carton", pu: 21864.231271111777 },  // L53
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHILI CHEESE BITES NEW", cond: 450, inner: 50, unite: "Carton", pu: 32548.470785285055 },  // L54
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHILI CHEESE BITES CONWAY", cond: 208, inner: 52, unite: "Carton", pu: 20329.419343999998 },  // L55
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CRISPY CHICKEN PATTY", cond: 136, inner: 17, unite: "Carton", pu: 42387.93290626717 },  // L56
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CRISPY CHICKEN CAIRO", cond: 112, inner: 14, unite: "Carton", pu: 24980 },  // L57
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHICKEN CRUNCHY FILLER ", cond: 120, inner: 10, unite: "Carton", pu: 65571.35139016686 },  // L58
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "VALUE PATTY CHICKEN  CRISPY", cond: 250, inner: 25, unite: "Carton", pu: 60731.319432181444 },  // L59
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "CHICKEN STRIPS", cond: 250, inner: 21, unite: "Carton", pu: 60731.319432181444 },  // L60
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "NUGGETS - CAIRO", cond: 660, inner: 55, unite: "Carton", pu: 55887.5364 },  // L61
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "FISH PATTY", cond: 40, unite: "Carton", pu: 22511.885313633316 },  // L62
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "FRITES", cond: 5, unite: "Carton", pu: 17834.364927904764 },  // L63
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H1 4' Bun", cond: 144, inner: 24, unite: "Carton", pu: 36565 },  // L64
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "4' Bun - Modern Bakeries", cond: 120, inner: 20, unite: "Carton", pu: 19974.737837118515 },  // L65
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H1 4' Bun Local", inner: 12, unite: "Inner", pu: 1800 },  // L66
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H1 4' Bun Local 01", inner: 6, unite: "Inner", pu: 1855.93220338 },  // L67
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H2 5' Bun", cond: 90, inner: 15, unite: "Carton", pu: 29512.28110491956 },  // L68
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H2 5' Bun Local", inner: 6, unite: "Inner", pu: 1290 },  // L69
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "5' Bun - Modern Bakeries", cond: 72, inner: 12, unite: "Carton", pu: 17856.80110491956 },  // L70
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H3 7' Bun", cond: 108, inner: 18, unite: "Carton", pu: 39577.133985186745 },  // L71
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "7' Bun - Modern Bakeries", cond: 96, inner: 16, unite: "Carton", pu: 21477.593985186748 },  // L72
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H3 7' Bun Local", inner: 10, unite: "Inner", pu: 2750 },  // L73
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "H4 Corn dusted 4,5' Bun", cond: 90, inner: 15, unite: "Carton", pu: 17946.268113449823 },  // L74
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "4,5' Bun Corn Dusted - Modern Bakeries", cond: 72, inner: 12, unite: "Carton", pu: 11579 },  // L75
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "4' Bun - Delico", cond: 120, inner: 20, unite: "Carton", pu: 15227.283748766047 },  // L76
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "5' Bun - Delico", cond: 72, inner: 12, unite: "Carton", pu: 10742.30466403162 },  // L77
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "7' Bun - Delico", cond: 126, inner: 21, unite: "Carton", pu: 16373.940199128367 },  // L78
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "4,5' Bun - Delico", cond: 72, inner: 12, unite: "Carton", pu: 11022.171428571428 },  // L79
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "BUN 4’’ NOUGATINE ", cond: 72, inner: 12, unite: "Unité", pu: 8640 },  // L80
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "BUN 5’’ NOUGATINE 48", cond: 48, inner: 8, unite: "Unité", pu: 6720 },  // L81
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "HAMBURGER PATTY - Americana", cond: 240, unite: "Carton", pu: 57188 },  // L82
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "HAMBURGER PATTY - Toledo", cond: 373, unite: "Carton", pu: 80069 },  // L83
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "LONG CHICKEN PATTY", cond: 112, inner: 14, unite: "Carton", pu: 71799.67526195453 },  // L84
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "LONG CHICKEN PATTY - CAIRO", cond: 120, inner: 12, unite: "Carton", pu: 71799.67526195453 },  // L85
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "MOZZARELLA STICKS BIS", cond: 204, inner: 34, unite: "Carton", pu: 31068 },  // L86
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "MUFFIN CHOCOLAT", cond: 60, unite: "Carton", pu: 34739.56738577078 },  // L87
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "MUFFIN CHOCOLAT - NOUGATINE", cond: 75, inner: 25, unite: "Carton", pu: 34957.627118644064 },  // L88
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "MUFFIN VANILLE - NOUGATINE", cond: 75, inner: 25, unite: "Carton", pu: 34957.627118644064 },  // L89
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "NUGGETS (ALFEIN)", cond: 568, inner: 71, unite: "Carton", pu: 55887.536400000005 },  // L90
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "ONION RINGS", cond: 792, inner: 66, unite: "Carton", pu: 27534.451032 },  // L91
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "ONION RINGS - Mc Cain", cond: 630, inner: 63, unite: "Carton", pu: 21138.63256170561 },  // L92
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "ŒUFS FRITS - ANGULAS AGUINAGA", cond: 120, inner: 12, unite: "Carton", pu: 45024.88848 },  // L93
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "TENDERCRISP PATTY", cond: 95, inner: 12, unite: "Carton", pu: 86714.16957095455 },  // L94
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "WHOPPER PATTY  - Americana", cond: 112, unite: "Carton", pu: 62011.397282596554 },  // L95
  { cat: "Nourriture - Surgelé", frns: "SIA", nom: "WHOPPER PATTY  - Toledo", cond: 152, unite: "Carton", pu: 76514 },  // L96
  { cat: "Nourriture - Frais", frns: "SIA", nom: "FROMAGE TRANCHE", cond: 1056, inner: 176, unite: "Carton", pu: 65659.25972263963 },  // L97
  { cat: "Nourriture - Frais", frns: "SIA", nom: "FROMAGE TRANCHE CONWAY", cond: 1104, inner: 184, unite: "Carton", pu: 65426.314989153274 },  // L98
  { cat: "Nourriture - Frais", frns: "SIA", nom: "FROMAGE MEDHDI NEW", cond: 288, inner: 24, unite: "Carton", pu: 38400 },  // L99
  { cat: "Nourriture - Frais", frns: "SIA", nom: "KIT KAT MIX", cond: 16, unite: "Carton", pu: 63014.532745241064 },  // L100
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CONE GLACE - Conway", cond: 550, unite: "Carton", pu: 21161.846035970422 },  // L101
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CONE GLACE - Frosty Boy", cond: 224, unite: "Carton", pu: 6496 },  // L102
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CONE GLACE – MEHDI", cond: 250, inner: 10, unite: "Carton", pu: 12203.3898305 },  // L103
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CONE GLACE 100", cond: 100, inner: 50, unite: "Carton", pu: 5932.203389830509 },  // L104
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CORNICHONS", cond: 6, unite: "Carton", pu: 17336.839626256788 },  // L105
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CORNICHONS MEHDI", cond: 1, unite: "Pot de 10 Kg", pu: 13559.322033898306 },  // L106
  { cat: "Nourriture - Sec", frns: "SIA", nom: "CRISPY ONIONS", cond: 6, unite: "Carton", pu: 23351.96461603576 },  // L107
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DIP BBQ", cond: 150, unite: "Carton", pu: 12985.600742265811 },  // L108
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DIP CHIPOTLE RANCH ", cond: 150, unite: "Carton", pu: 16603 },  // L109
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DIP CURRY", cond: 150, unite: "Carton", pu: 12997.233218967833 },  // L110
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DIP HOT SALSA", cond: 150, unite: "Carton ", pu: 13283.12925 },  // L111
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DIP FRITE SAUCE - 25GR", cond: 100, unite: "Carton ", pu: 9036.77282873868 },  // L112
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DOSETTE FRITE SAUCE PORTION - 10GR", cond: 200, unite: "Carton", pu: 6250.000000000001 },  // L113
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DOSETTE KETCHUP PORTION - 10GR", cond: 1500, unite: "Carton", pu: 31360.790691050704 },  // L114
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DOSETTE KETCHUP PUIDOR - 9GR", cond: 1000, unite: "Carton", pu: 10169 },  // L115
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DOSETTE KETCHUP MEHDI - 12ml", cond: 288, unite: "Carton", pu: 5508.75 },  // L116
  { cat: "Nourriture - Sec", frns: "SIA", nom: "DOSETTE KETCHUP SIPRO - 11ml", cond: 288, unite: "Carton", pu: 4637 },  // L117
  { cat: "Nourriture - Sec", frns: "SIA", nom: "HUILE AYA 25 L", cond: 1, unite: "Bidon de 25 L", pu: 21186.440677966104 },  // L118
  { cat: "Nourriture - Sec", frns: "SIA", nom: "JALAPENOS", cond: 4, unite: "Carton", pu: 26435.067099999997 },  // L119
  { cat: "Nourriture - Sec", frns: "SIA", nom: "JALAPENOS - ZEYTURSAN", cond: 6, unite: "Carton", pu: 20500.24457923293 },  // L120
  { cat: "Nourriture - Sec", frns: "SIA", nom: "JALAPENOS - MEHDI", cond: 6, unite: "Carton", pu: 33050.8474576 },  // L121
  { cat: "Nourriture - Sec", frns: "SIA", nom: "JALAPENOS - MEHDI LOCAL", cond: 6, unite: "Carton", pu: 36000 },  // L122
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MAIS DOUX", cond: 12, unite: "Pack de 12 boîtes", pu: 11184 },  // L123
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MAIS DOUX 600 g", cond: 12, unite: "Pack de 12 boîtes", pu: 18804 },  // L124
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MIX Poudre", cond: 8, unite: "Carton", pu: 32221.57380980179 },  // L125
  { cat: "Nourriture - Sec", frns: "SIA", nom: "OIGNONS FRITS KHUNE (PROSUMA)", cond: 12, unite: "Carton", pu: 1011.8644067796611 },  // L126
  { cat: "Nourriture - Sec", frns: "SIA", nom: "OIGNONS FRITS KHUNE (SUPERMARCHE)", cond: 12, unite: "inner", pu: 850 },  // L127
  { cat: "Nourriture - Sec", frns: "SIA", nom: "OREO MIX", cond: 12, unite: "Carton", pu: 40145.09009048995 },  // L128
  { cat: "Nourriture - Sec", frns: "SIA", nom: "OREO MIX CREME", cond: 12, unite: "Carton", pu: 40145.09009048995 },  // L129
  { cat: "Nourriture - Sec", frns: "SIA", nom: "TOBLERONE", cond: 12, unite: "Carton", pu: 18192.573820799997 },  // L130
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE BBQ WESTERN", cond: 8, unite: "Carton", pu: 13517.961856 },  // L131
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE BBQ SIPRO ", cond: 12, unite: "Carton", pu: 9152.55 },  // L132
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE BBQ PUIDOR", cond: 1, unite: "Carton", pu: 14831 },  // L133
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE BIG KING", cond: 14, unite: "Carton", pu: 37281.25196638136 },  // L134
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE CARAMEL", cond: 6, unite: "Carton", pu: 19557.4891464 },  // L135
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE CARAMEL SD", cond: 6, unite: "Carton", pu: 81000 },  // L136
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE CHILI CHEESE", cond: 8, unite: "Carton", pu: 21470.28031955626 },  // L137
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE CHOCOLAT NOIR MONIN", cond: 4, unite: "Carton", pu: 40000 },  // L138
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE CHOCOLAT", cond: 6, unite: "Carton", pu: 22629.3357774 },  // L139
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE FRAISE", cond: 6, unite: "Carton", pu: 27478.1699214 },  // L140
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE KETCHUP", cond: 1, unite: "Carton", pu: 20468.77676117763 },  // L141
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE KETCHUP DOLLYS", cond: 4, unite: "Carton", pu: 21864 },  // L142
  { cat: "Nourriture - Sec", frns: "SIA", nom: "KETCHUP - Local", cond: 4, unite: "Carton", pu: 16000 },  // L143
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE KETCHUP SIPRO 1Kg", cond: 6, unite: "Carton", pu: 7118.64406779661 },  // L144
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE KETCHUP PUIDOR - MEHDI", cond: 1, unite: "Carton", pu: 15254.2372881 },  // L145
  { cat: "Nourriture - Sec", frns: "SIA", nom: "TOMATE KETCHUP - MEHDI", cond: 6, unite: "Carton", pu: 19491.5254237 },  // L146
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE MAYONNAISE", cond: 7, unite: "Carton", pu: 37288.12 },  // L147
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MAYONNAISE - Local", cond: 4, unite: "Carton", pu: 26800 },  // L148
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE MAYO MEHDI", cond: 4, unite: "Carton", pu: 22035 },  // L149
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE MAYO PUIDOR", cond: 4, unite: "Carton", pu: 31356 },  // L150
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MAYONNAISE PIMENTEE", cond: 12, unite: "Carton", pu: 9153 },  // L151
  { cat: "Nourriture - Sec", frns: "SIA", nom: "MOUTARDE JAUNE BISKISHOP ", cond: 4, unite: "Bidon de 3,78 L", pu: 6166 },  // L152
  { cat: "Nourriture - Sec", frns: "SIA", nom: "VINAIGRETTE NATURE (500 ml)", cond: 12, unite: "Carton (12*500ml)", pu: 13779.661016949154 },  // L153
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE MOUTARDE", cond: 1, unite: "Carton", pu: 25500.20022737159 },  // L154
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE MOUTARDE - Local", cond: 12, unite: "Carton", pu: 13546 },  // L155
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE SALADE CESAR", cond: 30, unite: "Carton", pu: 7399.19496 },  // L156
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SAUCE SALADE CESAR 100", cond: 100, unite: "Carton", pu: 13570.277312171476 },  // L157
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SEL - Importé", cond: 10, unite: "Sachet 1 Kg", pu: 3830 },  // L158
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SEL - Local", cond: 20, unite: "Sachet 0,9 Kg", pu: 15000 },  // L159
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SEL FIN 500g", cond: 20, unite: "Sachet 0,5 Kg", pu: 6000 },  // L160
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SIROP CHOCOLAT SGG", cond: 12, unite: "12*0,624 kg / carton", pu: 30000 },  // L161
  { cat: "Nourriture - Frais", frns: "SIA", nom: "CONCOMBRE", unite: "Gramme", pu: 0.5 },  // L162
  { cat: "Nourriture - Frais", frns: "SIA", nom: "OIGNONS NON EPLUCHES", unite: "Kg", pu: 800 },  // L163
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SALADE ICEBERG - Boule (YG)", unite: "Kg", pu: 4300 },  // L164
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SALADE ICEBERG - Boule (SDB)", unite: "Kg", pu: 4192 },  // L165
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SALADE ICEBERG - Boule (SDB-06)", unite: "Kg", pu: 3000 },  // L166
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SALADE ICEBERG - Boule (BS)", unite: "Kg", pu: 4625 },  // L167
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SALADE ICEBERG - Boule ( HOREB)", unite: "Kg", pu: 11579 },  // L168
  { cat: "Nourriture - Frais", frns: "PFI", nom: "TOMATES PFI", unite: "Kg", pu: 2250 },  // L169
  { cat: "Nourriture - Frais", frns: "BNE", nom: "TOMATES BENEVA", unite: "Kg", pu: 0 },  // L170
  { cat: "Nourriture - Frais", frns: "SIA", nom: "DOSETTE FRITE SAUCE AMERIGO - 10GR", cond: 288, unite: "Carton", pu: 7200.000000000001 },  // L171
  { cat: "Nourriture - Frais", frns: "SIA", nom: "DOSETTE AMERIGO – 10 GR", cond: 250, unite: "Carton", pu: 7200 },  // L172
  { cat: "Nourriture - Frais", frns: "SIA", nom: "SAUCE MAYONNAISE AMERIGO", cond: 4, unite: "Carton de 4 * 3.8 kg", pu: 37288 },  // L173
  { cat: "Nourriture - Sec", frns: "SIA", nom: "SUCRE BUCHETTE", inner: 250, unite: "Carton de 250 bûchettes", pu: 1864 },  // L174
  { cat: "Packaging", frns: "SIA", nom: "AUTOCOLLANT LIVRAISON IMPRISUD ", inner: 8400, unite: "8400 stickers par inner", pu: 4 },  // L175
  { cat: "Packaging", frns: "SIA", nom: "AUTOCOLLANT LIVRAISON IMPRISUD BIS", inner: 10500, unite: "10500 stickers par inner", pu: 4 },  // L176
  { cat: "Packaging", frns: "SIA", nom: "BOITE A GATEAU", inner: 50, unite: "Inner de 50", pu: 2966.1 },  // L177
  { cat: "Packaging", frns: "SIA", nom: "BOITE ENFANT", cond: 180, unite: "Carton", pu: 0 },  // L178
  { cat: "Packaging", frns: "SIA", nom: "BOITE ENFANT 160", cond: 160, unite: "Carton", pu: 21515.389600000002 },  // L179
  { cat: "Packaging", frns: "SIA", nom: "BOL A SALADE", cond: 360, inner: 40, unite: "Carton", pu: 0 },  // L180
  { cat: "Packaging", frns: "SIA", nom: "BOL A SALADE NEW", cond: 160, unite: "Carton", pu: 27016.299489177458 },  // L181
  { cat: "Packaging", frns: "SIA", nom: "BOL A SALADE NEW 200", cond: 200, unite: "Carton", pu: 27445.9588978768 },  // L182
  { cat: "Packaging", frns: "SIA", nom: "BOL PLASTIQUE 50 ml", inner: 50, unite: "Inner de 50", pu: 1250 },  // L183
  { cat: "Packaging", frns: "SIA", nom: "COFFRET A FRITE ", cond: 1000, unite: "Unité", pu: 40000 },  // L184
  { cat: "Packaging", frns: "SIA", nom: "COURONNE", cond: 500, unite: "Carton", pu: 22630.5165 },  // L185
  { cat: "Packaging", frns: "SIA", nom: "COURONNE 400", cond: 400, unite: "Carton", pu: 23790.742903420512 },  // L186
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE BOL A SALADE", cond: 360, inner: 30, unite: "Carton", pu: 17902 },  // L187
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE GOBELET 25 CL", cond: 2000, inner: 100, unite: "Carton", pu: 24705.5480354832 },  // L188
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE GOBELET 40/50CL", cond: 2000, inner: 100, unite: "Carton", pu: 38713.00837539334 },  // L189
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE GOBELET 40/50CL - Conway", cond: 3750, inner: 150, unite: "Carton", pu: 43238.302693946294 },  // L190
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE TASSE CAFE 20 CL", cond: 1000, inner: 100, unite: "Carton", pu: 16398.925 },  // L191
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE TASSE CAFE 30/40 CL", cond: 1000, inner: 100, unite: "Carton", pu: 18366.796 },  // L192
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE TASSE EXPRESSO", cond: 1000, inner: 100, unite: "Carton", pu: 21446.0064293884 },  // L193
  { cat: "Packaging", frns: "SIA", nom: "FUSION COUVERCLE", cond: 1440, inner: 90, unite: "Carton", pu: 30688.242834886772 },  // L194
  { cat: "Packaging", frns: "SIA", nom: "FUSION CUILLERE", cond: 1000, inner: 500, unite: "Carton", pu: 65640.98211355656 },  // L195
  { cat: "Packaging", frns: "SIA", nom: "FUSION CUILLERE BOIS", cond: 2000, inner: 100, unite: "Carton", pu: 65255.82431875675 },  // L196
  { cat: "Packaging", frns: "SIA", nom: "FUSION CUP", cond: 1440, inner: 72, unite: "Carton", pu: 39672.27936 },  // L197
  { cat: "Packaging", frns: "SIA", nom: "FUSION CUP CONWAY", cond: 1000, inner: 50, unite: "Carton", pu: 46892 },  // L198
  { cat: "Packaging", frns: "SIA", nom: "GOBELET 25 CL", cond: 2250, inner: 90, unite: "Carton", pu: 46947 },  // L199
  { cat: "Packaging", frns: "SIA", nom: "GOBELET 25 CL - Conway", cond: 2000, inner: 100, unite: "Carton", pu: 51883.275182923324 },  // L200
  { cat: "Packaging", frns: "SIA", nom: "GOBELET 40 CL", cond: 1000, inner: 50, unite: "Carton", pu: 38137.00193465839 },  // L201
  { cat: "Packaging", frns: "SIA", nom: "GOBELET 50 CL", cond: 1000, inner: 50, unite: "Carton", pu: 46027.30185804299 },  // L202
  { cat: "Packaging", frns: "SIA", nom: "JOUETS ENFANT", cond: 200, unite: "Carton", pu: 114464.33364669445 },  // L203
  { cat: "Packaging", frns: "SIA", nom: "LIVRET DE JEUX", cond: 600, unite: "Carton", pu: 130000 },  // L204
  { cat: "Packaging", frns: "SIA", nom: "Kit Couvert - Bois", cond: 250, unite: "Unité", pu: 17135.877612832188 },  // L205
  { cat: "Packaging", frns: "SIA", nom: "Kit couvert BISKISHOP ", cond: 500, inner: 100, unite: "Carton", pu: 62000 },  // L206
  { cat: "Packaging", frns: "SIA", nom: "PAILLE MILKSHAKE (PAPIER)", inner: 200, unite: "Pack de 200", pu: 2967.544894461445 },  // L207
  { cat: "Packaging", frns: "SIA", nom: "PAILLE SODAS (PAPIER)", cond: 3500, inner: 500, unite: "Carton de 3500", pu: 31766.717428168206 },  // L208
  { cat: "Packaging", frns: "SIA", nom: "PETITE CUILLERE SACHET INDIVIDUEL - Local", cond: 100, unite: "Carton", pu: 14.0301318255556 },  // L209
  { cat: "Packaging", frns: "SIA", nom: "Porte Gobelet", cond: 480, unite: "Unité", pu: 29843.9989058756 },  // L210
  { cat: "Packaging", frns: "SIA", nom: "Sac à emporter grand (250p)", cond: 250, unite: "Carton", pu: 31006.18268881705 },  // L211
  { cat: "Packaging", frns: "SIA", nom: "Sac à emporter moyen (1000p)", cond: 1000, unite: "Carton", pu: 34283.54328324782 },  // L212
  { cat: "Packaging", frns: "SIA", nom: "Sac à emporter petit (1000p)", cond: 1000, unite: "Carton", pu: 31355.740805614663 },  // L213
  { cat: "Packaging", frns: "SIA", nom: "SAC ENFANT", cond: 400, unite: "Carton", pu: 34634.5296 },  // L214
  { cat: "Packaging", frns: "SIA", nom: "SAC ENFANT 1000", cond: 1000, unite: "Carton", pu: 65000 },  // L215
  { cat: "Packaging", frns: "SIA", nom: "SACHET FRITES GRAND", cond: 6000, inner: 100, unite: "Carton", pu: 39947.7813 },  // L216
  { cat: "Packaging", frns: "SIA", nom: "SACHET FRITES MOYEN", cond: 4000, inner: 100, unite: "Carton", pu: 25713.937869575642 },  // L217
  { cat: "Packaging", frns: "SIA", nom: "SACHET FRITES PETIT", cond: 5000, inner: 200, unite: "Carton", pu: 19749.2613302556 },  // L218
  { cat: "Packaging", frns: "SIA", nom: "SACHET FRITES PETIT 4000", cond: 4000, unite: "Carton", pu: 22201.59015642164 },  // L219
  { cat: "Packaging", frns: "SIA", nom: "SACHET SNACK GRAND", cond: 4000, inner: 100, unite: "Carton", pu: 76286.15965390581 },  // L220
  { cat: "Packaging", frns: "SIA", nom: "SACHET SNACK GRAND 3000", cond: 3000, inner: 100, unite: "Carton", pu: 32874.554198886704 },  // L221
  { cat: "Packaging", frns: "SIA", nom: "SACHET SNACK MOYEN", cond: 3600, inner: 100, unite: "Carton", pu: 33763.164805920685 },  // L222
  { cat: "Packaging", frns: "SIA", nom: "SACHET FRITES - SIKO", inner: 100, unite: "Inner", pu: 600 },  // L223
  { cat: "Packaging", frns: "SIA", nom: "SACHET SNACK MOYEN 2000", cond: 2000, unite: "Carton", pu: 27116.233703850234 },  // L224
  { cat: "Packaging", frns: "SIA", nom: "SACHET SNACK MOYEN 4000", cond: 4000, unite: "Carton", pu: 41423.907044276806 },  // L225
  { cat: "Packaging", frns: "SIA", nom: "SAC KRAFT BRUN 25 x 30 x 13 ", cond: 800, unite: "Carton", pu: 104000 },  // L226
  { cat: "Packaging", frns: "SIA", nom: "SANDY PAPER CUP", cond: 1750, inner: 50, unite: "Carton", pu: 76552.98625347538 },  // L227
  { cat: "Packaging", frns: "SIA", nom: "SERVIETTES INTERFOLIE", cond: 4800, inner: 200, unite: "Carton", pu: 11339.6598504 },  // L228
  { cat: "Packaging", frns: "SIA", nom: "SERVIETTES PAPYRUS", cond: 3600, inner: 100, unite: "Carton", pu: 10029.999999999996 },  // L229
  { cat: "Packaging", frns: "SIA", nom: "SERVIETTES NANO", cond: 900, inner: 100, unite: "Carton", pu: 3559 },  // L230
  { cat: "Packaging", frns: "SIA", nom: "SET A PLATEAU", cond: 500, unite: "Pack de 500", pu: 6500 },  // L231
  { cat: "Packaging", frns: "SIA", nom: "SNACK BUCKET", cond: 400, unite: "Carton", pu: 70580.97320000001 },  // L232
  { cat: "Packaging", frns: "SIA", nom: "SNACK BUCKET NEW", cond: 240, unite: "Carton", pu: 56202.39575999999 },  // L233
  { cat: "Packaging", frns: "SIA", nom: "COUVERCLE SNACK BUCKET NEW", cond: 240, unite: "Carton", pu: 11851.976854892106 },  // L234
  { cat: "Packaging", frns: "SIA", nom: "Sundae Cup", cond: 1380, inner: 60, unite: "Carton", pu: 43259.24468468566 },  // L235
  { cat: "Packaging", frns: "SIA", nom: "TASSE CAFE 20 CL", cond: 1250, inner: 50, unite: "Carton", pu: 43391.555550000005 },  // L236
  { cat: "Packaging", frns: "SIA", nom: "TASSE CAFE 20CL CONWAY", cond: 1050, inner: 30, unite: "Carton", pu: 43391.555550000005 },  // L237
  { cat: "Packaging", frns: "SIA", nom: "TASSE CAFE 30CL", cond: 800, inner: 40, unite: "Carton", pu: 43391.555550000005 },  // L238
  { cat: "Packaging", frns: "SIA", nom: "Tasse expresso", cond: 2000, inner: 80, unite: "Carton", pu: 36733.592 },  // L239
  { cat: "Packaging", frns: "SIA", nom: "Wrap Big King XL", cond: 3000, inner: 1000, unite: "Carton", pu: 39357.42 },  // L240
  { cat: "Packaging", frns: "SIA", nom: "WRAP DBL CHEESE/SMALL SPEC", cond: 5000, inner: 1000, unite: "Carton", pu: 52476.56 },  // L241
  { cat: "Packaging", frns: "SIA", nom: "WRAP GOURMET", cond: 2000, inner: 1000, unite: "Carton", pu: 27550.194 },  // L242
  { cat: "Packaging", frns: "SIA", nom: "WRAP HAMB/CHEESEBURGER", cond: 6000, inner: 1000, unite: "Carton", pu: 51164.646 },  // L243
  { cat: "Packaging", frns: "SIA", nom: "WRAP HAMB/CHEESEBURGER-5000", cond: 5000, inner: 1000, unite: "Carton", pu: 43304.80158075453 },  // L244
  { cat: "Packaging", frns: "SIA", nom: "Wrap Long Chicken", cond: 3000, inner: 1000, unite: "Carton", pu: 40236.69159991033 },  // L245
  { cat: "Packaging", frns: "SIA", nom: "WRAP MULTI PETIT 5000", cond: 5000, inner: 1000, unite: "Carton", pu: 48052.03435729037 },  // L246
  { cat: "Packaging", frns: "SIA", nom: "WRAP MULTI GRAND 3000", cond: 3000, inner: 1000, unite: "Carton", pu: 45580.08041072546 },  // L247
  { cat: "Packaging", frns: "SIA", nom: "WRAP MULTI GRAND", cond: 2000, inner: 1000, unite: "Carton", pu: 32797.85 },  // L248
  { cat: "Packaging", frns: "SIA", nom: "Wrap Steakhouse", cond: 2000, inner: 1000, unite: "Carton", pu: 32797.85 },  // L249
  { cat: "Packaging", frns: "SIA", nom: "Wrap Tendercrisp", cond: 2000, inner: 1000, unite: "Carton", pu: 32797.85 },  // L250
  { cat: "Packaging", frns: "SIA", nom: "Wrap Whopper", cond: 2000, inner: 1000, unite: "Carton", pu: 36733.592 },  // L251
  { cat: "Packaging", frns: "SIA", nom: "Wrap Whopper Jr", cond: 5000, inner: 1000, unite: "Carton", pu: 45916.99 },  // L252
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ACTIGEL", cond: 6, unite: "Carton", pu: 16212.588321065985 },  // L253
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ANTIBACTERIAL HAND SOAP & EPICARE", cond: 12, unite: "Carton", pu: 29509.735927943675 },  // L254
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "AROMIST REFILL", cond: 4, unite: "Carton", pu: 24530.522219852115 },  // L255
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "AROMIST STARTER KIT", cond: 1, unite: "Carton", pu: 20941 },  // L256
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "AMH FOAM", cond: 2, unite: "Carton", pu: 57477.41542604996 },  // L257
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BACTIGEL GEL 1 LITRE", cond: 12, unite: "Carton", pu: 1144.0833333333333 },  // L258
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BALAIS - Bleu", cond: 2, unite: "Carton", pu: 22568 },  // L259
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BALAIS - Jaune", cond: 2, unite: "Carton", pu: 20081 },  // L260
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BALAIS - Rouge", cond: 2, unite: "Carton", pu: 23512.766336862453 },  // L261
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BROSSE - Bleu", cond: 2, unite: "Carton", pu: 18454 },  // L262
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BROSSE - Jaune", cond: 2, unite: "Carton", pu: 27523 },  // L263
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BROSSE - Rouge", cond: 2, unite: "Carton", pu: 18856.668467730735 },  // L264
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BROSSE BOUTEILLE KETCHUP", cond: 10, unite: "Carton", pu: 5806.924780096249 },  // L265
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "BROSSE A ONGLES", cond: 20, unite: "Carton", pu: 10523.515396197183 },  // L266
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "DEGREASER", cond: 4, unite: "Carton", pu: 18722.734053835764 },  // L267
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "DELIMER", cond: 48, unite: "Carton", pu: 10758 },  // L268
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "CHARLOTTES PROMASTER ", cond: 100, unite: "Pack de 100", pu: 1700 },  // L269
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "CHLORINE TEST STRIPS", cond: 2, unite: "Carton", pu: 6969.345799219622 },  // L270
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "CHLORINE TEST STRIPS NEW", cond: 200, unite: "Carton", pu: 3558.061183 },  // L271
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "FREEZER/COOLER CLEANER", cond: 2, unite: "Carton", pu: 33517.828314043516 },  // L272
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "FRYER CLEANSER", cond: 6, unite: "Carton", pu: 11633 },  // L273
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GANTS NITRILE BLEU NON POUDRE - boite 100", inner: 100, unite: "Boîte", pu: 3178 },  // L274
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GANTS VINYL BLEU NON POUDRE - boite 100", cond: 10, inner: 100, unite: "Boîte", pu: 3902.3861829769703 },  // L275
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GANTS SACHET PACK DE 100", cond: 10, inner: 100, unite: "Inner de 100", pu: 552 },  // L276
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GANTS SACHET PACK DE 500", cond: 20, inner: 500, unite: "Boite de 500", pu: 5296.599999999999 },  // L277
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GLASS & MULTISURFACE CLEANER", cond: 4, unite: "Carton", pu: 17505.238700726513 },  // L278
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "GRAFFITI REMOVER (PEP-EX)", cond: 6, unite: "Carton", pu: 27631.29047797949 },  // L279
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "HEAT ACTIVATED GRILL & TOASTER CLEANER", cond: 4, unite: "Carton", pu: 19045.97783075195 },  // L280
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "HI TEMP BROILER - NO SCRATCH PAD", cond: 18, unite: "Carton", pu: 11320.265069353907 },  // L281
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "HI TEMP FRYER - PAD", cond: 10, unite: "Carton", pu: 15464.46645561303 },  // L282
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SUPER CONTACT CLEANER", cond: 4, unite: "Carton", pu: 17252 },  // L283
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "KOTE SOIL SHIELD", cond: 6, unite: "Carton", pu: 17605 },  // L284
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "KAY POWER PAD", cond: 12, unite: "Carton", pu: 18425 },  // L285
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "KAY 5", cond: 200, unite: "Carton", pu: 21512 },  // L286
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "KAY-5 SANITIZER", cond: 240, inner: 60, unite: "Carton", pu: 22994.903653922367 },  // L287
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "LAVETTE - Bleu", cond: 100, inner: 10, unite: "Carton", pu: 10708.020609761688 },  // L288
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "LAVETTE - Jaune", cond: 100, inner: 10, unite: "Carton", pu: 11600 },  // L289
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "LAVETTE - Rouge", cond: 100, inner: 10, unite: "Carton", pu: 10885.603563041048 },  // L290
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "LAVETTE - Vert", cond: 100, inner: 10, unite: "Carton", pu: 11397 },  // L291
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "MULTIPURPOSE CONCENTRATE", cond: 1, unite: "Bidon de 10 L", pu: 14322.59623992168 },  // L292
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ORION SOFT CARE PLUS PURE", cond: 2, unite: "Carton", pu: 38339 },  // L293
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "OVEN CLEANER", cond: 6, unite: "Carton", pu: 25140.83216272163 },  // L294
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "PAPIER TOILETTE JUMBO (18 ROULEAUX)", cond: 18, unite: "Pack de 18", pu: 18305.08 },  // L295
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "QUARRY TILE FLOOR CLEANER", cond: 120, unite: "Carton", pu: 19903.979104550956 },  // L296
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "RACLETTE - Rouge", cond: 2, unite: "Carton", pu: 27894.355034571443 },  // L297
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "RACLETTE - Bleu", cond: 2, unite: "Carton", pu: 27894.355034571443 },  // L298
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "RESTROOM CLEANER", cond: 6, unite: "Carton", pu: 23073.653323970047 },  // L299
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROULEAU ADVANCED", cond: 6, unite: "PACK", pu: 36000 },  // L300
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROULEAU ESSUIE TOUT", cond: 6, unite: "Unité", pu: 13600 },  // L301
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROULEAU ESSUIE TOUT - NANO", cond: 6, unite: "PACK", pu: 12429.378531022223 },  // L302
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROULEAU ESSUIE TOUT - 1*3", cond: 3, unite: "Pack de 03", pu: 7379 },  // L303
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROULEAU PH SMARTON 1*1", cond: 1, unite: "Unité", pu: 2850 },  // L304
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "ROOM CARE ECO", cond: 6, unite: "6 X 1L / carton", pu: 18457 },  // L305
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SAC POUBELLE - GM - Transparent", inner: 50, unite: "Pack de 50", pu: 7550 },  // L306
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SAC POUBELLE - PM - Transparent", inner: 250, unite: "Pack de 250", pu: 22000 },  // L307
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SANICHLOR", cond: 960, inner: 160, unite: "Carton", pu: 38621 },  // L308
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SANITIZER TABLETTE ", cond: 1380, inner: 230, unite: "Carton", pu: 62935 },  // L309
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SERPILLERE - Bleu", cond: 10, unite: "Carton", pu: 42738.57407391327 },  // L310
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SERPILLERE - Jaune", cond: 10, unite: "Carton", pu: 37600 },  // L311
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SERPILLERE - Rouge", cond: 10, unite: "Carton", pu: 41539.87397405759 },  // L312
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SERPILLERE - Vert", cond: 10, unite: "Carton", pu: 41539.87397405759 },  // L313
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SINK SANITIZER", cond: 200, unite: "Carton", pu: 16987.894493045216 },  // L314
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SINK SANITIZER TABLETS", cond: 200, unite: "Carton", pu: 20573.351299956226 },  // L315
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SANITIZER TABLETTE ", cond: 6, unite: "Carton", pu: 62935 },  // L316
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "STAINLESS CLEANER & POLISH", cond: 6, unite: "Carton", pu: 10060.270348591037 },  // L317
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SUPERSOAK CONCENTRATE", cond: 1, unite: "Bidon 10 L", pu: 27345.82292405665 },  // L318
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "SUMA CARBON REMOVER", cond: 2, unite: "Carton", pu: 26823 },  // L319
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "PULY CAFF POWER", cond: 5, unite: "Carton", pu: 12711.86 },  // L320
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "WMF LIQUIDE BLEU", cond: 1, unite: "Bidon", pu: 9991 },  // L321
  { cat: "Produits de Nettoyage", frns: "SIA", nom: "WMF PASTILLES", inner: 100, unite: "Pot de 100 pastilles", pu: 6887.5485 },  // L322
];
