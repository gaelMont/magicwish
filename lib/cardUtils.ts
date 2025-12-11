// lib/cardUtils.ts

// Type générique pour une carte Scryfall (simplifié)
export type ScryfallRawData = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  prices?: { eur?: string; usd?: string };
  image_uris?: { normal?: string };
  card_faces?: Array<{
    name: string;
    image_uris?: { normal?: string };
  }>;
};

// Fonction pour transformer la donnée brute en donnée propre pour notre app
export const normalizeCardData = (data: ScryfallRawData) => {
  // Gestion des cartes recto-verso
  const isDoubleFaced = data.card_faces && data.card_faces.length > 1;

  // 1. Nom : On prend le nom de la face avant si double face, sinon nom normal
  // On nettoie le " // " si Scryfall le laisse traîner
  const rawName = isDoubleFaced ? data.card_faces![0].name : data.name;
  const name = rawName.split(' // ')[0];

  // 2. Images
  let imageUrl = data.image_uris?.normal;
  let imageBackUrl = undefined; // ou null selon ta préférence

  if (isDoubleFaced) {
    imageUrl = data.card_faces![0].image_uris?.normal;
    imageBackUrl = data.card_faces![1].image_uris?.normal;
  }

  // Fallback si pas d'image (dos de carte)
  if (!imageUrl) {
    imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
  }

  return {
    id: data.id,
    scryfallId: data.id,
    name,
    imageUrl,
    imageBackUrl,
    setName: data.set_name,
    setCode: data.set,
    price: parseFloat(data.prices?.eur || "0"),
  };
};