// lib/cardUtils.ts

// Définition stricte des champs Scryfall que nous utilisons
// Cela évite les crashs si l'API change ou si on accède à un champ inexistant
export type ScryfallRawData = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  released_at?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
  };
  card_faces?: Array<{
    name: string;
    image_uris?: {
      normal?: string;
    };
  }>;
  prices?: {
    eur?: string;
    eur_foil?: string;
    usd?: string;
  };
  finishes?: string[]; // 'foil', 'nonfoil', 'etched'
  // On autorise d'autres champs inconnus sans casser le typage strict ci-dessus
  [key: string]: unknown;
};

export const normalizeCardData = (data: ScryfallRawData) => {
  // Gestion des noms pour les cartes doubles (ex: "Malakir Rebirth // Malakir Mire")
  const rawName = data.name;
  const name = rawName.split(' // ')[0]; 

  let imageUrl = "";
  let imageBackUrl: string | null = null;

  // CAS 1 : Carte standard (image à la racine)
  if (data.image_uris?.normal) {
    imageUrl = data.image_uris.normal;
  } 
  // CAS 2 : Carte double face (Transform, Modal DFC, etc.)
  else if (data.card_faces && data.card_faces.length > 0) {
    // Face Avant
    if (data.card_faces[0].image_uris?.normal) {
      imageUrl = data.card_faces[0].image_uris.normal;
    }
    
    // Face Arrière (si elle a une image)
    if (data.card_faces[1] && data.card_faces[1].image_uris?.normal) {
      imageBackUrl = data.card_faces[1].image_uris.normal;
    }
  }

  // Fallback si aucune image trouvée (Card Back par défaut)
  if (!imageUrl) {
    imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
  }

  return {
    id: data.id,
    scryfallId: data.id,
    name,
    imageUrl,
    imageBackUrl, // Sera string ou null (jamais undefined)
    setName: data.set_name,
    setCode: data.set,
    price: parseFloat(data.prices?.eur || "0"),
    scryfallData: data // On garde la donnée brute
  };
};