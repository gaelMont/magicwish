// lib/cardUtils.ts

// Type générique "fourre-tout" pour Scryfall
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScryfallRawData = any;

export const normalizeCardData = (data: ScryfallRawData) => {
  const isDoubleFaced = data.card_faces && data.card_faces.length > 1;
  const rawName = isDoubleFaced ? data.card_faces[0].name : data.name;
  const name = rawName.split(' // ')[0];

  let imageUrl = data.image_uris?.normal;
  let imageBackUrl = undefined;

  if (isDoubleFaced) {
    imageUrl = data.card_faces[0].image_uris?.normal;
    imageBackUrl = data.card_faces[1].image_uris?.normal;
  }

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
    // On peut aussi retourner la data brute ici si besoin, mais c'est fait ailleurs
  };
};