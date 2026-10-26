// Table « Perte_Q1 2026 » du classeur de référence du CDG — exact/suivis stock BK 1.xlsx,
// feuille Perte_Q1 2026, lignes 5→195, colonnes B (Catégorie), C (Nom Article), D (Cond.),
// E (Prix carton), G (Unité de perte). Extraite cellule par cellule (commentaire de fin de ligne =
// numéro de ligne source), générée par frontend/tests/tmp_exact_module.mjs.
//
// Le CDG a demandé (26/10) que notre classeur reproduise cette table à l identique : mêmes articles,
// même ordre, mêmes catégories, mêmes conditionnements, mêmes unités de perte. Le prix carton n est
// absent (champ pu manquant) que sur les 5 lignes où la référence affiche 0 : leurs formules
// XLOOKUP ne trouvent pas l article, le prix est donc résolu par nos sources habituelles.
export const PERTES_REFERENTIEL_CDG = [
  { cat: "Boissons", nom: "BIERE BEAUFORT 33cl", cond: 24, pu: 7950, unite: "pièce" },  // L5
  { cat: "Boissons", nom: "BIERE BOCK 33cl", cond: 24, pu: 6000, unite: "pièce" },  // L6
  { cat: "Boissons", nom: "BIERE BOCK 50cl", cond: 24, pu: 8262.71186440678, unite: "pièce" },  // L7
  { cat: "Boissons", nom: "BOUTEILLE COCA COLA 50cL", cond: 6, pu: 1449.1525423728815, unite: "pièce" },  // L8
  { cat: "Boissons", nom: "BOUTEILLE COCA COLA 1.5L", cond: 6, pu: 3686, unite: "pièce" },  // L9
  { cat: "Boissons", nom: "BOUTEILLE COCA COLA ZERO 50cL", cond: 6, pu: 1449.1525423728815, unite: "pièce" },  // L10
  { cat: "Boissons", nom: "BOUTEILLE COCA COLA ZERO 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L11
  { cat: "Boissons", nom: "BOUTEILLE FANTA 50cL", cond: 6, pu: 1449.1525423728815, unite: "pièce" },  // L12
  { cat: "Boissons", nom: "BOUTEILLE FANTA 1.5L", cond: 6, pu: 3686, unite: "pièce" },  // L13
  { cat: "Boissons", nom: "BOUTEILLE FANTA COCKTAIL 30cL", cond: 12, pu: 1529.6610169491526, unite: "pièce" },  // L14
  { cat: "Boissons", nom: "BOUTEILLE FANTA ANANAS 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L15
  { cat: "Boissons", nom: "BOUTEILLE FANTA FRUITS ROUGES 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L16
  { cat: "Boissons", nom: "BOUTEILLE FANTA POMME 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L17
  { cat: "Boissons", nom: "BOUTEILLE SCHWEPPES AGRUMES 30cL", cond: 12, pu: 1690.677966101695, unite: "pièce" },  // L18
  { cat: "Boissons", nom: "BOUTEILLE SPRITE 50cL", cond: 6, pu: 1207.6271186440679, unite: "pièce" },  // L19
  { cat: "Boissons", nom: "BOUTEILLE SPRITE 1.5L", cond: 6, pu: 3686, unite: "pièce" },  // L20
  { cat: "Boissons", nom: "BOUTEILLE PEPSI ZERO 30CL ", cond: 12, pu: 1476, unite: "pièce" },  // L21
  { cat: "Boissons", nom: "MIRINDA ORANGE PET 30CL", cond: 12, pu: 1476, unite: "pièce" },  // L22
  { cat: "Boissons", nom: "BOUTEILLE 7UP 30CL", cond: 12, pu: 1476, unite: "pièce" },  // L23
  { cat: "Boissons", nom: "BOUTEILLE PEPSI ZERO 1,5L", cond: 6, unite: "pièce" },  // L24
  { cat: "Boissons", nom: "CAN PEPSI 250ML ", cond: 24, pu: 1530, unite: "pièce" },  // L25
  { cat: "Boissons", nom: "CANETTE PEPSI ZERO 25 CL", cond: 24, pu: 1530, unite: "pièce" },  // L26
  { cat: "Boissons", nom: "BOUTEILLE PEPSI 1.5L", cond: 6, pu: 3150, unite: "pièce" },  // L27
  { cat: "Boissons", nom: "BOUTEILLE PEPSI  30CL", cond: 12, pu: 1476, unite: "pièce" },  // L28
  { cat: "Boissons", nom: "BOUTEILLE MIRINDA FRUIT ROUGE 30 CL", cond: 12, pu: 1476, unite: "pièce" },  // L29
  { cat: "Boissons", nom: "CAFE EN GRAINS 250 g", cond: 250, pu: 3432, unite: "g" },  // L30
  { cat: "Boissons", nom: "PRESSEA - Ananas 200ML", cond: 24, pu: 3050.8474576271187, unite: "pièce" },  // L31
  { cat: "Boissons", nom: "PRESSEA - Orange 200ML", cond: 24, pu: 3050.8474576271187, unite: "pièce" },  // L32
  { cat: "Boissons", nom: "PRESSEA - Pomme 200ML", cond: 24, pu: 3050.8474576271187, unite: "pièce" },  // L33
  { cat: "Boissons", nom: "PRESSEA - Cocktail 200ML", cond: 24, pu: 3050.8474576271187, unite: "pièce" },  // L34
  { cat: "Boissons", nom: "PRESSEA - Goyave 200ML", cond: 24, pu: 3050.8474576271187, unite: "pièce" },  // L35
  { cat: "Boissons", nom: "BOUTEILLE COCA COLA 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L36
  { cat: "Boissons", nom: "EAU KIRENE 50 CL 12  ", cond: 12, pu: 950, unite: "pièce" },  // L37
  { cat: "Boissons", nom: "EAU KIRENE 50 CL 16", cond: 16, pu: 1250, unite: "pièce" },  // L38
  { cat: "Boissons", nom: "BOUTEILLE FANTA 30cL", cond: 12, pu: 1409.322033898305, unite: "pièce" },  // L39
  { cat: "Boissons", nom: "MILO", cond: 1, pu: 105.93, unite: "pièce" },  // L40
  { cat: "Boissons", nom: "BOUTEILLE SPRITE 30cL", cond: 12, pu: 1207.6271186440679, unite: "pièce" },  // L41
  { cat: "Boissons", nom: "BOUTEILLE ORANGINA 50cL", cond: 6, pu: 2033.898305084746, unite: "pièce" },  // L42
  { cat: "Boissons", nom: "ORANGINA 33CL", cond: 24, pu: 6406.77966101695, unite: "pièce" },  // L43
  { cat: "Boissons", nom: "THE", cond: 1, pu: 29.322, unite: "pièce" },  // L44
  { cat: "Boissons", nom: "LAIT en Brique", cond: 12, pu: 10944, unite: "litre" },  // L45
  { cat: "Boissons", nom: "LAIT en brique - PROSUMA", cond: 12, pu: 10238.53211, unite: "litre" },  // L46
  { cat: "Boissons", nom: "LAIT en brique - PROSUMA_06", cond: 6, pu: 5548.6238532, unite: "litre" },  // L47
  { cat: "Nourriture - Frais", nom: "CONCOMBRE", cond: 1000, pu: 500, unite: "g" },  // L48
  { cat: "Nourriture - Frais", nom: "DOSETTE FRITE SAUCE AMERIGO - 10GR,", cond: 250, pu: 7200.000000000001, unite: "pièce" },  // L49
  { cat: "Nourriture - Frais", nom: "SAUCE MAYONNAISE AMERIGO", cond: 15.2, pu: 37288, unite: "kg" },  // L50
  { cat: "Nourriture - Frais", nom: "OIGNONS NON EPLUCHES", cond: 5, pu: 4000, unite: "kg" },  // L51
  { cat: "Nourriture - Frais", nom: "SALADE ICEBERG - Boule (BS)", cond: 8, pu: 42000, unite: "kg" },  // L52
  { cat: "Nourriture - Frais", nom: "SALADE ICEBERG - Boule (YG)", cond: 7, pu: 14400, unite: "kg" },  // L53
  { cat: "Nourriture - Frais", nom: "SALADE ICEBERG - Boule (SDB)", cond: 6.8, pu: 28500, unite: "kg" },  // L54
  { cat: "Nourriture - Frais", nom: "SALADE ICEBERG - Boule (SDB-06)", cond: 4.8, pu: 17100, unite: "kg" },  // L55
  { cat: "Nourriture - Frais", nom: "SALADE ICEBERG - Boule ( HOREB)", cond: 4.75, pu: 55000, unite: "kg" },  // L56
  { cat: "Nourriture - Frais", nom: "TOMATES PFI", cond: 1, pu: 1850, unite: "kg" },  // L57
  { cat: "Nourriture - Frais", nom: "FROMAGE TRANCHE", cond: 1056, pu: 65659.25972263963, unite: "pièce" },  // L58
  { cat: "Nourriture - Frais", nom: "FROMAGE TRANCHE CONWAY", cond: 1104, pu: 65426.314989153274, unite: "pièce" },  // L59
  { cat: "Nourriture - Frais", nom: "FROMAGE MEDHI NEW", cond: 288, pu: 38400, unite: "pièce" },  // L60
  { cat: "Nourriture - Frais", nom: "KIT KAT MIX", cond: 6.4, pu: 63014.532745241064, unite: "kg" },  // L61
  { cat: "Nourriture - Sec", nom: "CONE GLACE - Conway", cond: 550, pu: 21161.846035970422, unite: "pièce" },  // L62
  { cat: "Nourriture - Sec", nom: "CONE GLACE - Frosty Boy", cond: 224, pu: 6496, unite: "pièce" },  // L63
  { cat: "Nourriture - Sec", nom: "CONE GLACE – MEHDI", cond: 250, pu: 12203.3898305, unite: "pièce" },  // L64
  { cat: "Nourriture - Sec", nom: "CONE GLACE 100", cond: 100, pu: 5932.203389830509, unite: "pièce" },  // L65
  { cat: "Nourriture - Sec", nom: "CORNICHONS", cond: 2004, pu: 17336.839626256788, unite: "pièce" },  // L66
  { cat: "Nourriture - Sec", nom: "CORNICHONS MEHDI", cond: 10, pu: 13559.322033898306, unite: "kg" },  // L67
  { cat: "Nourriture - Sec", nom: "CRISPY ONIONS", cond: 6, pu: 23351.96461603576, unite: "kg" },  // L68
  { cat: "Nourriture - Sec", nom: "DIP BBQ", cond: 150, pu: 12985.600742265811, unite: "pièce" },  // L69
  { cat: "Nourriture - Sec", nom: "DIP CURRY", cond: 150, pu: 12997.233218967833, unite: "pièce" },  // L70
  { cat: "Nourriture - Sec", nom: "DIP CHIPOTLE RANCH ", cond: 150, pu: 16603, unite: "pièce" },  // L71
  { cat: "Nourriture - Sec", nom: "DIP HOT SALSA", cond: 150, pu: 13283.12925, unite: "pièce" },  // L72
  { cat: "Nourriture - Sec", nom: "DIP FRITE SAUCE - 25GR", cond: 100, pu: 9036.77282873868, unite: "pièce" },  // L73
  { cat: "Nourriture - Sec", nom: "DOSETTE FRITE SAUCE PORTION - 10GR", cond: 200, pu: 6250.000000000001, unite: "pièce" },  // L74
  { cat: "Nourriture - Sec", nom: "DOSETTE FRITE SAUCE AMERIGO - 10GR", cond: 288, pu: 7200.000000000001, unite: "pièce" },  // L75
  { cat: "Nourriture - Sec", nom: "DOSETTE KETCHUP PORTION - 10GR", cond: 1500, pu: 31360.790691050704, unite: "pièce" },  // L76
  { cat: "Nourriture - Sec", nom: "DOSETTE KETCHUP SIPRO - 11ml", cond: 288, pu: 4637, unite: "pièce" },  // L77
  { cat: "Nourriture - Sec", nom: "HUILE AYA 25 L", cond: 25, pu: 21186.440677966104, unite: "litre" },  // L78
  { cat: "Nourriture - Sec", nom: "HUILE AYA 5 L", cond: 20, pu: 18644.0677966, unite: "litre" },  // L79
  { cat: "Nourriture - Sec", nom: "JALAPENOS", cond: 3100, pu: 26435.067099999997, unite: "pièce" },  // L80
  { cat: "Nourriture - Sec", nom: "JALAPENOS - ZEYTURSAN", cond: 3550, pu: 20500.24457923293, unite: "pièce" },  // L81
  { cat: "Nourriture - Sec", nom: "JALAPENOS - MEHDI", cond: 3564, pu: 33050.8474576, unite: "pièce" },  // L82
  { cat: "Nourriture - Sec", nom: "JALAPENOS - MEHDI local", cond: 3564, pu: 36000, unite: "pièce" },  // L83
  { cat: "Nourriture - Sec", nom: "Mix Poudre", cond: 12, pu: 32221.57380980179, unite: "kg" },  // L84
  { cat: "Nourriture - Sec", nom: "OIGNONS FRITS KHUNE (PROSUMA)", cond: 100, pu: 1011.8644067796611, unite: "g" },  // L85
  { cat: "Nourriture - Sec", nom: "OREO MIX", cond: 4.8, pu: 40145.09009048995, unite: "kg" },  // L86
  { cat: "Nourriture - Sec", nom: "OREO MIX CREME", cond: 4.8, pu: 40145.09009048995, unite: "kg" },  // L87
  { cat: "Nourriture - Sec", nom: "TOBLERONE", cond: 4.8, pu: 18192.573820799997, unite: "kg" },  // L88
  { cat: "Nourriture - Sec", nom: "SAUCE BBQ WESTERN", cond: 8, pu: 13518.650292837081, unite: "kg" },  // L89
  { cat: "Nourriture - Sec", nom: "SAUCE BBQ SIPRO ", cond: 4.2, pu: 9152.55, unite: "kg" },  // L90
  { cat: "Nourriture - Sec", nom: "SAUCE BIG KING", cond: 14, pu: 37281.25196638136, unite: "kg" },  // L91
  { cat: "Nourriture - Sec", nom: "SAUCE CARAMEL", cond: 7.2, pu: 19557.4891464, unite: "kg" },  // L92
  { cat: "Nourriture - Sec", nom: "SAUCE CARAMEL SD", cond: 15, pu: 81000, unite: "kg" },  // L93
  { cat: "Nourriture - Sec", nom: "SAUCE CHILI CHEESE", cond: 8, pu: 25315.64700349768, unite: "kg" },  // L94
  { cat: "Nourriture - Sec", nom: "SAUCE CHOCOLAT NOIR MONIN", cond: 7.56, pu: 38983, unite: "litre" },  // L95
  { cat: "Nourriture - Sec", nom: "SAUCE CHOCOLAT", cond: 6.6, pu: 22629.3357774, unite: "kg" },  // L96
  { cat: "Nourriture - Sec", nom: "SIROP CHOCOLAT SGG", cond: 7.488, pu: 30000, unite: "kg" },  // L97
  { cat: "Nourriture - Sec", nom: "SAUCE FRAISE", cond: 6.6, pu: 27478.1699214, unite: "kg" },  // L98
  { cat: "Nourriture - Sec", nom: "SAUCE KETCHUP", cond: 15, pu: 20468.77676117763, unite: "kg" },  // L99
  { cat: "Nourriture - Sec", nom: "SAUCE KETCHUP DOLLYS", cond: 20, pu: 21864, unite: "kg" },  // L100
  { cat: "Nourriture - Sec", nom: "KETCHUP - Local", cond: 16, pu: 16000, unite: "litre" },  // L101
  { cat: "Nourriture - Sec", nom: "SAUCE KETCHUP SIPRO 1Kg", cond: 6, pu: 7118.64406779661, unite: "kg" },  // L102
  { cat: "Nourriture - Sec", nom: "SAUCE KETCHUP PUIDOR - MEHDI", cond: 10, pu: 15254.2372881, unite: "kg" },  // L103
  { cat: "Nourriture - Sec", nom: "TOMATE KETCHUP - MEHDI", cond: 14.4, pu: 19491.5254237, unite: "kg" },  // L104
  { cat: "Nourriture - Sec", nom: "SAUCE MAYONNAISE", cond: 14, pu: 37288.12, unite: "kg" },  // L105
  { cat: "Nourriture - Sec", nom: "MAYONNAISE - Local", cond: 15.2, pu: 26800, unite: "litre" },  // L106
  { cat: "Nourriture - Sec", nom: "SAUCE MAYO MEHDI", cond: 16, pu: 22035, unite: "kg" },  // L107
  { cat: "Nourriture - Sec", nom: "MAYONNAISE PIMENTEE", cond: 4.2, pu: 9153, unite: "litre" },  // L108
  { cat: "Nourriture - Sec", nom: "VINAIGRETTE NATURE (500 ml)", cond: 6, pu: 13779.661016949154, unite: "litre" },  // L109
  { cat: "Nourriture - Sec", nom: "SAUCE MOUTARDE", cond: 14.5, pu: 25500.20022737159, unite: "kg" },  // L110
  { cat: "Nourriture - Sec", nom: "MOUTARDE JAUNE BISKISHOP", cond: 15.12, pu: 37000, unite: "litre" },  // L111
  { cat: "Nourriture - Sec", nom: "SAUCE SALADE CESAR", cond: 30, pu: 7399.19496, unite: "pièce" },  // L112
  { cat: "Nourriture - Sec", nom: "SAUCE SALADE CESAR 100", cond: 100, pu: 13570.2773121715, unite: "pièce" },  // L113
  { cat: "Nourriture - Sec", nom: "SEL - Local", cond: 18.14, pu: 15000, unite: "kg" },  // L114
  { cat: "Nourriture - Sec", nom: "MAIS DOUX", cond: 3.42, pu: 11184, unite: "kg" },  // L115
  { cat: "Nourriture - Sec", nom: "MAIS DOUX 600 g", cond: 7.2, pu: 18804, unite: "kg" },  // L116
  { cat: "Nourriture - Surgelé", nom: "Chicken crunchy filler ", cond: 120, pu: 65571.35139016686, unite: "pièce" },  // L117
  { cat: "Nourriture - Surgelé", nom: "CHICKEN WINGS", cond: 330, pu: 59744.56356000001, unite: "pièce" },  // L118
  { cat: "Nourriture - Surgelé", nom: "CHICKEN WINGS - CAIRO", cond: 340, pu: 33876.35730433728, unite: "pièce" },  // L119
  { cat: "Nourriture - Surgelé", nom: "CHICKEN WHOPPER GRILLED", cond: 67, pu: 55196.693329943686, unite: "pièce" },  // L120
  { cat: "Nourriture - Surgelé", nom: "VALUE PATTY CHICKEN  CRISPY", cond: 250, pu: 60731.319432181444, unite: "pièce" },  // L121
  { cat: "Nourriture - Surgelé", nom: "CHICKEN STRIPS", cond: 250, pu: 60731.319432181444, unite: "pièce" },  // L122
  { cat: "Nourriture - Surgelé", nom: "NUGGETS - CAIRO", cond: 660, pu: 55887.536400000005, unite: "pièce" },  // L123
  { cat: "Nourriture - Surgelé", nom: "CHILI CHEESE BITES", cond: 300, pu: 21864.231271111777, unite: "pièce" },  // L124
  { cat: "Nourriture - Surgelé", nom: "CHILI CHEESE BITES NEW", cond: 450, pu: 32548.470785285055, unite: "pièce" },  // L125
  { cat: "Nourriture - Surgelé", nom: "CHILI CHEESE BITES CONWAY", cond: 208, pu: 20329.419343999998, unite: "pièce" },  // L126
  { cat: "Nourriture - Surgelé", nom: "CRISPY CHICKEN PATTY", cond: 136, pu: 42387.93290626717, unite: "pièce" },  // L127
  { cat: "Nourriture - Surgelé", nom: "CRISPY CHICKEN CAIRO", cond: 112, pu: 50394, unite: "pièce" },  // L128
  { cat: "Nourriture - Surgelé", nom: "FRITES", cond: 12.5, pu: 17834.364927904764, unite: "kg" },  // L129
  { cat: "Nourriture - Surgelé", nom: "H1 4' Bun", cond: 144, pu: 1800, unite: "pièce" },  // L130
  { cat: "Nourriture - Surgelé", nom: "BUN 5’’ NOUGATINE 48 ", cond: 48, pu: 7560, unite: "pièce" },  // L131
  { cat: "Nourriture - Surgelé", nom: "4' Bun - Modern Bakeries", cond: 120, pu: 19974.737837118515, unite: "pièce" },  // L132
  { cat: "Nourriture - Surgelé", nom: "H1 4' Bun Local", cond: 12, pu: 1800, unite: "pièce" },  // L133
  { cat: "Nourriture - Surgelé", nom: "BUN 7'' NOUGATINE ", cond: 75, pu: 9375, unite: "pièce" },  // L134
  { cat: "Nourriture - Surgelé", nom: "BUN 4'' NOUGATINE ", cond: 72, pu: 8640, unite: "pièce" },  // L135
  { cat: "Nourriture - Surgelé", nom: "BUN 5'' Nougatine", cond: 54, pu: 7560, unite: "pièce" },  // L136
  { cat: "Nourriture - Surgelé", nom: "H2 5' Bun", cond: 90, unite: "pièce" },  // L137
  { cat: "Nourriture - Surgelé", nom: "5' Bun - Modern Bakeries", cond: 72, pu: 17856.80110491956, unite: "pièce" },  // L138
  { cat: "Nourriture - Surgelé", nom: "H2 5' Bun Local", cond: 6, pu: 1290, unite: "pièce" },  // L139
  { cat: "Nourriture - Surgelé", nom: "H3 7' Bun", cond: 108, unite: "pièce" },  // L140
  { cat: "Nourriture - Surgelé", nom: "7' Bun - Modern Bakeries", cond: 96, pu: 21477.593985186748, unite: "pièce" },  // L141
  { cat: "Nourriture - Surgelé", nom: "H3 7' Bun Local", cond: 10, pu: 2750, unite: "pièce" },  // L142
  { cat: "Nourriture - Surgelé", nom: "H4 Corn dusted 4,5' Bun", cond: 90, unite: "pièce" },  // L143
  { cat: "Nourriture - Surgelé", nom: "4,5' Bun Corn Dusted - Modern Bakeries", cond: 72, pu: 11579, unite: "pièce" },  // L144
  { cat: "Nourriture - Surgelé", nom: "4' Bun - Delico", cond: 120, pu: 17803, unite: "pièce" },  // L145
  { cat: "Nourriture - Surgelé", nom: "5' Bun - Delico", cond: 72, pu: 10742.30466403162, unite: "pièce" },  // L146
  { cat: "Nourriture - Surgelé", nom: "7' Bun - Delico", cond: 126, pu: 19323, unite: "pièce" },  // L147
  { cat: "Nourriture - Surgelé", nom: "4,5' Bun - Delico", cond: 72, pu: 12122, unite: "pièce" },  // L148
  { cat: "Nourriture - Surgelé", nom: "HAMBURGER PATTY - Americana", cond: 240, pu: 57188.09838630518, unite: "pièce" },  // L149
  { cat: "Nourriture - Surgelé", nom: "Hamburger Patty Toledo", cond: 373, pu: 80069, unite: "pièce" },  // L150
  { cat: "Nourriture - Surgelé", nom: "LONG CHICKEN PATTY", cond: 112, pu: 71799.67526195453, unite: "pièce" },  // L151
  { cat: "Nourriture - Surgelé", nom: "LONG CHICKEN PATTY - CAIRO", cond: 120, pu: 71799.67526195453, unite: "pièce" },  // L152
  { cat: "Nourriture - Surgelé", nom: "MUFFIN CHOCOLAT", cond: 60, pu: 34739.56738577078, unite: "pièce" },  // L153
  { cat: "Nourriture - Surgelé", nom: "MUFFIN CHOCOLAT - NOUGATINE", cond: 75, pu: 34957.627118644064, unite: "pièce" },  // L154
  { cat: "Nourriture - Surgelé", nom: "MUFFIN VANILLE - NOUGATINE", cond: 75, pu: 34957.627118644064, unite: "pièce" },  // L155
  { cat: "Nourriture - Surgelé", nom: "NUGGETS (ALFEIN)", cond: 568, pu: 55887.536400000005, unite: "pièce" },  // L156
  { cat: "Nourriture - Surgelé", nom: "ONION RINGS", cond: 792, pu: 27534.451032, unite: "pièce" },  // L157
  { cat: "Nourriture - Surgelé", nom: "ONION RINGS - Mc Cain", cond: 630, pu: 21138.63256170561, unite: "pièce" },  // L158
  { cat: "Nourriture - Surgelé", nom: "ŒUFS FRITS - ANGULAS AGUINAGA", cond: 120, pu: 45024.88848, unite: "pièce" },  // L159
  { cat: "Nourriture - Surgelé", nom: "TENDERCRISP PATTY", cond: 95, pu: 86714.16957095455, unite: "pièce" },  // L160
  { cat: "Nourriture - Surgelé", nom: "WHOPPER PATTY  - Americana", cond: 112, pu: 62011.397282596554, unite: "pièce" },  // L161
  { cat: "Nourriture - Surgelé", nom: "Whopper Patty Toledo", cond: 152, pu: 76514, unite: "pièce" },  // L162
  { cat: "Nourriture - Surgelé", nom: "FISH PATTY", cond: 40, pu: 22511.885313633316, unite: "pièce" },  // L163
  { cat: "Nourriture - Surgelé", nom: "MOZZARELLA STICKS ", cond: 204, pu: 31068, unite: "pièce" },  // L164
  { cat: "Produit fini", nom: "M EXPRESSO", cond: 1, pu: 283, unite: "pièce" },  // L165
  { cat: "Produit fini", nom: "L EXPRESSO", cond: 1, pu: 283, unite: "pièce" },  // L166
  { cat: "Produit fini", nom: "WHOPPER", cond: 1, pu: 1095.2947590164324, unite: "pièce" },  // L167
  { cat: "Produit fini", nom: "WHOPPER CHEESE", cond: 1, pu: 1219.6494175820378, unite: "pièce" },  // L168
  { cat: "Produit fini", nom: "DOUBLE WHOPPER", cond: 1, pu: 1641.8499517572375, unite: "pièce" },  // L169
  { cat: "Produit fini", nom: "WHOPPER JUNIOR", cond: 1, pu: 589.7637985405461, unite: "pièce" },  // L170
  { cat: "Produit fini", nom: "BBQ TENDERCRISP", cond: 1, pu: 1267.544415244713, unite: "pièce" },  // L171
  { cat: "Produit fini", nom: "BIG KING", cond: 1, pu: 891.9826301033739, unite: "pièce" },  // L172
  { cat: "Produit fini", nom: "BIG KING XXL", cond: 1, pu: 1761.945461849591, unite: "pièce" },  // L173
  { cat: "Produit fini", nom: "DELUXE", cond: 1, pu: 1243.3922284126097, unite: "pièce" },  // L174
  { cat: "Produit fini", nom: "LONG CHICKEN", cond: 1, pu: 778.9091448681183, unite: "pièce" },  // L175
  { cat: "Produit fini", nom: "LONG CHILI CHEESE CHICKEN", cond: 1, pu: 992.172547590629, unite: "pièce" },  // L176
  { cat: "Produit fini", nom: "EXTRA LONG CHILI CHEESE", cond: 1, pu: 1145.8693545729996, unite: "pièce" },  // L177
  { cat: "Produit fini", nom: "CHILI CHEESE BURGER", cond: 1, pu: 707.2680694172046, unite: "pièce" },  // L178
  { cat: "Produit fini", nom: "HAMBURGER", cond: 1, pu: 445.93580824862215, unite: "pièce" },  // L179
  { cat: "Produit fini", nom: "HAMBURGER JUNIOR", cond: 1, pu: 1393.610130902011, unite: "pièce" },  // L180
  { cat: "Produit fini", nom: "CHEESEBURGER", cond: 1, pu: 508.11313753142485, unite: "pièce" },  // L181
  { cat: "Produit fini", nom: "CHEESEBURGER JUNIOR", cond: 1, unite: "pièce" },  // L182
  { cat: "Produit fini", nom: "DOUBLE CHEESE BURGER", cond: 1, pu: 808.5742509294404, unite: "pièce" },  // L183
  { cat: "Produit fini", nom: "TENDERCRISP", cond: 1, pu: 1043.0895608153235, unite: "pièce" },  // L184
  { cat: "Produit fini", nom: "TENDERGRILL", cond: 1, pu: 1287.3099819402146, unite: "pièce" },  // L185
  { cat: "Produit fini", nom: "CRISPY CHICKEN", cond: 1, pu: 681.4152979430024, unite: "pièce" },  // L186
  { cat: "Produit fini", nom: "CHICKEN BURGER PETIT PRIX", cond: 1, pu: 438.6547478919612, unite: "pièce" },  // L187
  { cat: "Produit fini", nom: "VALUE CHICKEN JR", cond: 1, pu: 1453.2534650475072, unite: "pièce" },  // L188
  { cat: "Produit fini", nom: "KING FISH", cond: 1, pu: 881.6304482687132, unite: "pièce" },  // L189
  { cat: "Produit fini", nom: "SALADE FRAICHEUR", cond: 1, pu: 1074.2753656959942, unite: "pièce" },  // L190
  { cat: "Produit fini", nom: "SALADE POULET CROUSTILLANT", cond: 1, pu: 1567.1821506292647, unite: "pièce" },  // L191
  { cat: "Produit fini", nom: "SALADE POULET GRILLE", cond: 1, pu: 1902.1099123370539, unite: "pièce" },  // L192
  { cat: "Produit fini", nom: "LTO #4: MOZZARELLA STICKS x4", cond: 1, pu: 728.8180021015697, unite: "pièce" },  // L193
  { cat: "Produit fini", nom: "LTO #5: MOZZARELLA STICKS x6", cond: 1, pu: 1133.9735324508365, unite: "pièce" },  // L194
  { cat: "Produit fini", nom: "LTO #6: MOZZARELLA STICKS x9", cond: 1, pu: 1597.390214547998, unite: "pièce" },  // L195
];
