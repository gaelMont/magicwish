// lib/cardUtils.ts

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
    colors?: string[]; 
  }>;
  prices?: {
    eur?: string;
    eur_foil?: string;
    usd?: string;
  };
  finishes?: string[];
  cmc?: number;
  colors?: string[]; 
  color_identity?: string[]; // <-- LE CHAMP IMPORTANT
  [key: string]: unknown;
};

export const normalizeCardData = (data: ScryfallRawData) => {
  const rawName = data.name;
  const name = rawName.split(' // ')[0]; 

  let imageUrl = "";
  let imageBackUrl: string | null = null;

  if (data.image_uris?.normal) {
    imageUrl = data.image_uris.normal;
  } 
  else if (data.card_faces && data.card_faces.length > 0) {
    if (data.card_faces[0].image_uris?.normal) {
      imageUrl = data.card_faces[0].image_uris.normal;
    }
    if (data.card_faces[1] && data.card_faces[1].image_uris?.normal) {
      imageBackUrl = data.card_faces[1].image_uris.normal;
    }
  }

  if (!imageUrl) {
    imageUrl = "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
  }

  // --- CORRECTION : PRIORITÉ À L'IDENTITÉ COULEUR ---
  let finalColors = data.color_identity || [];
  
  if ((!finalColors || finalColors.length === 0) && data.colors) {
      finalColors = data.colors;
  }
  
  if ((!finalColors || finalColors.length === 0) && data.card_faces) {
      const combined = new Set<string>();
      data.card_faces.forEach(face => {
          face.colors?.forEach(c => combined.add(c));
      });
      finalColors = Array.from(combined);
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
    scryfallData: data,
    
    cmc: data.cmc !== undefined ? data.cmc : 0,
    colors: finalColors 
  };
};