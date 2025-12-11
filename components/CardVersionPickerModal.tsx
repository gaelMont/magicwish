'use client';

import { useState, useEffect, useMemo } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import toast from 'react-hot-toast';

// 1. Définition précise du type Scryfall pour éviter les erreurs "Unexpected any"
export type ScryfallCardRaw = {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  released_at: string;
  image_uris?: { normal: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
  prices?: { eur?: string; eur_foil?: string };
  finishes?: string[]; // Important pour savoir si la carte existe en foil
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  baseCard: ScryfallCardRaw | null; // On utilise le bon type ici
  onConfirm: (card: CardType) => void;
};

export default function CardVersionPickerModal({ isOpen, onClose, baseCard, onConfirm }: Props) {
  const [versions, setVersions] = useState<ScryfallCardRaw[]>([]);
  const [loading, setLoading] = useState(false);
  
  // États de sélection
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isFoil, setIsFoil] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // 2. useEffect corrigé : fetchVersions est défini DEDANS
  useEffect(() => {
    // Fonction définie localement pour éviter les soucis de dépendances
    const fetchVersions = async (oracleId: string) => {
        setLoading(true);
        try {
          const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}&unique=prints&order=released`);
          const data = await res.json();
          
          if (data.data && data.data.length > 0) {
            setVersions(data.data as ScryfallCardRaw[]); // Casting explicite
            
            // Par défaut, on sélectionne la version sur laquelle on a cliqué ou la plus récente
            const defaultVer = data.data.find((c: ScryfallCardRaw) => c.id === baseCard?.id) || data.data[0];
            setSelectedVersionId(defaultVer.id);
          }
        } catch (e) {
          console.error(e);
          toast.error("Impossible de charger les versions");
        } finally {
          setLoading(false);
        }
    };

    if (isOpen && baseCard?.oracle_id) {
      fetchVersions(baseCard.oracle_id);
    }

    // Reset des états à l'ouverture
    setQuantity(1);
    setIsFoil(false);
  }, [isOpen, baseCard]); // fetchVersions n'est plus requis ici

  // La version actuellement affichée
  const currentCard = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId) || baseCard;
  }, [versions, selectedVersionId, baseCard]);

  // Si on n'a pas de carte (ex: modale fermée ou chargement initial), on ne rend rien
  if (!isOpen || !currentCard) return null;

  // Gestion des images (Recto/Verso)
  const imageUrl = currentCard.image_uris?.normal || currentCard.card_faces?.[0]?.image_uris?.normal || "https://cards.scryfall.io/large/front/a/6/a6984342-f723-4e80-8e69-902d287a915f.jpg";
  
  // Gestion des prix (Normal vs Foil)
  const priceNormal = parseFloat(currentCard.prices?.eur || "0");
  const priceFoil = parseFloat(currentCard.prices?.eur_foil || "0");
  
  const currentPrice = isFoil ? (priceFoil || priceNormal) : (priceNormal || priceFoil);
  
  // Vérification des finitions disponibles
  const hasFoilVersion = currentCard.finishes?.includes('foil') || !!currentCard.prices?.eur_foil;
  const hasNonFoilVersion = currentCard.finishes?.includes('nonfoil') || !!currentCard.prices?.eur;

  const handleConfirm = () => {
    const finalCard: CardType = {
        id: currentCard.id,
        name: currentCard.name,
        imageUrl: imageUrl,
        quantity: quantity,
        price: currentPrice,
        setName: currentCard.set_name,
        setCode: currentCard.set,
        isFoil: isFoil,
        isSpecificVersion: true // Puisqu'on a choisi manuellement le set
    };
    onConfirm(finalCard);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-4 flex justify-between items-center border-b border-gray-800">
            <h3 className="text-white font-bold truncate pr-4">{currentCard.name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white px-2 text-xl">✕</button>
        </div>

        {/* CONTENU SCROLLABLE */}
        <div className="overflow-y-auto p-6 flex flex-col items-center space-y-6 custom-scrollbar">
            
            {/* 1. IMAGE DISPLAY */}
            <div className="relative w-64 aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 group">
                {loading ? (
                    <div className="w-full h-full bg-gray-800 animate-pulse flex items-center justify-center text-gray-500">Chargement...</div>
                ) : (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                )}
                {isFoil && <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/30 to-transparent mix-blend-overlay pointer-events-none" />}
            </div>

            {/* 2. SÉLECTEUR D'ÉDITION */}
            <div className="w-full space-y-2">
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Édition / Set</label>
                <div className="relative">
                    <select 
                        className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={selectedVersionId}
                        onChange={(e) => {
                            setSelectedVersionId(e.target.value);
                            // On remet non-foil par défaut quand on change d'édition pour éviter les conflits
                            setIsFoil(false); 
                        }}
                    >
                        {versions.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.set_name} ({v.set.toUpperCase()}) #{v.collector_number}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                </div>
            </div>

            {/* 3. CONTROLES (Foil & Quantité) */}
            <div className="grid grid-cols-2 gap-4 w-full">
                
                {/* Toggle Foil */}
                <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center justify-center gap-2 border border-gray-700">
                    <span className="text-xs text-gray-400 font-bold">FINITION</span>
                    <div className="flex bg-gray-900 rounded-lg p-1 w-full">
                        <button 
                            onClick={() => setIsFoil(false)}
                            disabled={!hasNonFoilVersion}
                            className={`flex-1 text-xs py-1.5 rounded-md transition ${!isFoil ? 'bg-gray-700 text-white font-bold' : 'text-gray-500 hover:text-gray-300'} ${!hasNonFoilVersion && 'opacity-30 cursor-not-allowed'}`}
                        >
                            Normal
                        </button>
                        <button 
                            onClick={() => setIsFoil(true)}
                            disabled={!hasFoilVersion}
                            className={`flex-1 text-xs py-1.5 rounded-md transition ${isFoil ? 'bg-purple-600 text-white font-bold' : 'text-gray-500 hover:text-purple-400'} ${!hasFoilVersion && 'opacity-30 cursor-not-allowed'}`}
                        >
                            Foil
                        </button>
                    </div>
                </div>

                {/* Compteur Quantité */}
                <div className="bg-gray-800 rounded-xl p-3 flex flex-col items-center justify-center gap-2 border border-gray-700">
                     <span className="text-xs text-gray-400 font-bold">QUANTITÉ</span>
                     <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full bg-gray-700 text-white hover:bg-gray-600 font-bold">-</button>
                        <span className="text-xl font-bold text-white w-6 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-full bg-blue-600 text-white hover:bg-blue-500 font-bold">+</button>
                     </div>
                </div>
            </div>
        </div>

        {/* FOOTER - PRIX & VALIDATION */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
            <div className="flex justify-between items-center mb-4">
                 <div className="text-gray-400 text-sm">Prix unitaire</div>
                 <div className="text-2xl font-bold text-white">
                    {currentPrice > 0 ? `${currentPrice.toFixed(2)} €` : <span className="text-gray-500 text-lg">N/A</span>}
                 </div>
            </div>
            
            <button 
                onClick={handleConfirm}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl text-lg transition shadow-lg transform active:scale-95 flex justify-center items-center gap-2"
            >
                <span>+ Ajouter</span>
                {quantity > 1 && <span className="bg-black/20 px-2 py-0.5 rounded text-sm">{quantity}</span>}
            </button>
        </div>

      </div>
    </div>
  );
}