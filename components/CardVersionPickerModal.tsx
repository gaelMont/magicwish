// components/CardVersionPickerModal.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { CardType } from '@/hooks/useCardCollection';
import { normalizeCardData, ScryfallRawData } from '@/lib/cardUtils'; 
import { WishlistMeta } from '@/hooks/useWishlists'; 
import toast from 'react-hot-toast';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  baseCard: ScryfallRawData | null; 
  onConfirm: (card: CardType, targetListId?: string) => void;
  destination?: 'collection' | 'wishlist'; 
  availableLists?: WishlistMeta[];
};

export default function CardVersionPickerModal({ 
  isOpen, onClose, baseCard, onConfirm, destination, availableLists 
}: Props) {
  // ... (états inchangés : versions, loading, selectedVersionId, etc.) ...
  const [versions, setVersions] = useState<ScryfallRawData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isFoil, setIsFoil] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false); 
  const [anyVersion, setAnyVersion] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('default');

  // ... (useEffect de chargement inchangé) ...
  useEffect(() => {
    const fetchVersions = async (oracleId: string) => {
        setLoading(true);
        try {
          const res = await fetch(`https://api.scryfall.com/cards/search?q=oracle_id:${oracleId}&unique=prints&order=released`);
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            setVersions(data.data); 
            const defaultVer = data.data.find((c: ScryfallRawData) => c.id === baseCard?.id) || data.data[0];
            setSelectedVersionId(defaultVer.id);
          }
        } catch (e) { console.error(e); toast.error("Erreur versions"); } 
        finally { setLoading(false); }
    };

    if (isOpen && baseCard?.oracle_id) {
      fetchVersions(baseCard.oracle_id as string);
    }

    setQuantity(1);
    setIsFoil(false);
    setIsFlipped(false);
    setAnyVersion(false);
    setSelectedListId('default'); 
  }, [isOpen, baseCard]); 

  // ... (currentCardRaw, currentPrice, etc. inchangés) ...
  const currentCardRaw = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId) || baseCard;
  }, [versions, selectedVersionId, baseCard]);

  if (!isOpen || !currentCardRaw) return null;

  const { imageUrl, imageBackUrl, name, setName, setCode, price } = normalizeCardData(currentCardRaw);
  
  const priceNormal = parseFloat(currentCardRaw.prices?.eur || "0");
  const priceFoil = parseFloat(currentCardRaw.prices?.eur_foil || "0");
  const currentPrice = isFoil ? (priceFoil || priceNormal) : (priceNormal || priceFoil);
  
  const hasFoilVersion = currentCardRaw.finishes?.includes('foil') || !!currentCardRaw.prices?.eur_foil;
  const hasNonFoilVersion = currentCardRaw.finishes?.includes('nonfoil') || !!currentCardRaw.prices?.eur;

  // --- CORRECTION ICI ---
  const handleConfirm = () => {
    const finalCard: CardType = {
        id: currentCardRaw.id,
        name: name,
        imageUrl: imageUrl,
        imageBackUrl: imageBackUrl || undefined,
        quantity: quantity,
        price: currentPrice,
        setName: setName,
        setCode: setCode,
        isFoil: isFoil,
        isSpecificVersion: !anyVersion, 
        scryfallData: currentCardRaw,
        // CORRECTION TYPE : undefined au lieu de null
        wishlistId: destination === 'wishlist' ? selectedListId : undefined 
    };
    
    // On passe l'ID de la liste pour que SearchPage sache où écrire
    onConfirm(finalCard, selectedListId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-4 flex justify-between items-center border-b border-gray-800">
            <h3 className="text-white font-bold truncate pr-4">{name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white px-2 text-xl">✕</button>
        </div>

        {/* CONTENU */}
        <div className="overflow-y-auto p-6 flex flex-col items-center space-y-6 custom-scrollbar">
            
            {/* IMAGE */}
            <div className="relative w-64 aspect-[2.5/3.5] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 group cursor-pointer" onClick={() => imageBackUrl && setIsFlipped(!isFlipped)}>
                {loading ? (
                    <div className="w-full h-full bg-gray-800 animate-pulse flex items-center justify-center text-gray-500">Chargement...</div>
                ) : (
                    <img src={isFlipped && imageBackUrl ? imageBackUrl : imageUrl} alt="" className={`w-full h-full object-cover transition-transform duration-300 ${anyVersion ? 'opacity-80 grayscale-[50%]' : ''}`} />
                )}
                {anyVersion && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-full text-sm shadow-lg border border-white/20">✨ Générique</span>
                    </div>
                )}
                {isFoil && !anyVersion && <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/30 to-transparent mix-blend-overlay pointer-events-none" />}
            </div>

            {/* SÉLECTION WISHLIST (Seulement si mode wishlist) */}
            {destination === 'wishlist' && availableLists && availableLists.length > 0 && (
                <div className="w-full space-y-1 bg-purple-900/20 p-3 rounded-xl border border-purple-500/30">
                    <label className="text-xs text-purple-300 font-bold uppercase tracking-wider">Ajouter à la liste :</label>
                    <select 
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        {availableLists.map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ÉDITION (Masquée si Generic) */}
            <div className={`w-full space-y-2 transition-opacity ${anyVersion ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Édition / Set</label>
                <div className="relative">
                    <select 
                        className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={selectedVersionId}
                        onChange={(e) => { setSelectedVersionId(e.target.value); setIsFoil(false); setIsFlipped(false); }}
                    >
                        {versions.map((v) => (
                            <option key={v.id} value={v.id}>{v.set_name} ({v.set.toUpperCase()}) #{v.collector_number}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
                </div>
            </div>

            {/* OPTIONS */}
            <div className="w-full space-y-4">
                {/* Switch Generic */}
                <label className="flex items-center justify-between bg-blue-900/20 p-3 rounded-xl border border-blue-900/50 cursor-pointer hover:bg-blue-900/30 transition">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-100">Peu importe l&apos;édition</span>
                        <span className="text-[10px] text-blue-300">Le scanner cherchera juste le nom &quot;{name}&quot;</span>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={anyVersion} onChange={(e) => setAnyVersion(e.target.checked)} />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                </label>

                {/* Finition & Quantité */}
                <div className="flex gap-4">
                    <div className={`flex-1 bg-gray-800 rounded-xl p-2 flex flex-col items-center justify-center gap-1 border border-gray-700 transition-opacity ${anyVersion ? 'opacity-30 pointer-events-none' : ''}`}>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Finition</span>
                        <div className="flex bg-gray-900 rounded-lg p-1 w-full">
                            <button onClick={() => setIsFoil(false)} disabled={!hasNonFoilVersion} className={`flex-1 text-[10px] py-1 rounded transition ${!isFoil ? 'bg-gray-700 text-white font-bold' : 'text-gray-500'} ${!hasNonFoilVersion && 'opacity-30'}`}>Normal</button>
                            <button onClick={() => setIsFoil(true)} disabled={!hasFoilVersion} className={`flex-1 text-[10px] py-1 rounded transition ${isFoil ? 'bg-purple-600 text-white font-bold' : 'text-gray-500'} ${!hasFoilVersion && 'opacity-30'}`}>Foil</button>
                        </div>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-xl p-2 flex flex-col items-center justify-center gap-1 border border-gray-700">
                         <span className="text-[10px] text-gray-400 font-bold uppercase">Quantité</span>
                         <div className="flex items-center gap-3">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-6 h-6 rounded-full bg-gray-700 text-white font-bold">-</button>
                            <span className="text-lg font-bold text-white w-4 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold">+</button>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
            <button 
                onClick={handleConfirm}
                className={`w-full font-bold py-4 rounded-xl text-lg transition shadow-lg transform active:scale-95 flex justify-center items-center gap-2 ${anyVersion ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}
            >
                <span>{anyVersion ? '✨ Ajouter (Générique)' : '+ Ajouter (Exact)'}</span>
                {quantity > 1 && <span className="bg-black/20 px-2 py-0.5 rounded text-sm">{quantity}</span>}
            </button>
        </div>
      </div>
    </div>
  );
}