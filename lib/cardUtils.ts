// lib/cardUtils.ts

// Type générique "fourre-tout" pour Scryfall
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScryfallRawData = any;

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
    imageUrl = data.card_faces[0].image_uris?.normal;
    
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