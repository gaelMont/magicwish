import { ScryfallRawData } from '@/lib/cardUtils';

// Note le mot-clé "export" ici
export type ValidationResult = {
  isValid: boolean;
  reason?: string;
  suggestedAction?: 'FORCE_FOIL' | 'FORCE_NONFOIL' | 'REJECT';
};

/**
 * Vérifie si une demande d'import est valide par rapport aux données Scryfall.
 * Empêche d'importer une version qui n'existe pas physiquement.
 */
// Note le mot-clé "export" ici aussi !
export function validateImport(
  cardData: ScryfallRawData, 
  requestedFoil: boolean
): ValidationResult {
  
  // Sécurisation des prix et finitions (conversion en nombre pour éviter les erreurs)
  const priceNormal = parseFloat(cardData.prices?.eur || "0");
  const priceFoil = parseFloat(cardData.prices?.eur_foil || "0");

  // Une version existe si elle est dans 'finishes' OU si elle a un prix
  const hasNonFoil = cardData.finishes?.includes('nonfoil') || priceNormal > 0;
  const hasFoil = cardData.finishes?.includes('foil') || priceFoil > 0;

  // Cas 1 : L'utilisateur VEUT du Foil
  if (requestedFoil) {
    if (!hasFoil) {
      return { 
        isValid: false, 
        reason: `La carte "${cardData.name}" n'existe pas en version Foil pour cette édition (${cardData.set.toUpperCase()}).`,
        suggestedAction: hasNonFoil ? 'FORCE_NONFOIL' : 'REJECT'
      };
    }
  } 
  // Cas 2 : L'utilisateur VEUT du Normal (ou n'a rien précisé)
  else {
    if (!hasNonFoil) {
      // Si elle n'existe QU'EN Foil (ex: Commander decks, From the Vault...)
      if (hasFoil) {
          return { 
            isValid: false, 
            reason: `La carte "${cardData.name}" n'existe qu'en Foil (Edition spéciale).`,
            suggestedAction: 'FORCE_FOIL'
          };
      }
      return {
          isValid: false,
          reason: `Cette carte ne semble exister ni en Foil ni en Normal pour cette édition.`,
          suggestedAction: 'REJECT'
      };
    }
  }

  return { isValid: true };
}