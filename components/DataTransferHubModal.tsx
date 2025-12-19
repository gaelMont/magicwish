// components/DataTransferHubModal.tsx
'use client';

type DataTransferHubProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectImport: () => void;
  onSelectExport: () => void;
  targetLabel: 'Collection' | 'Wishlist';
};

export default function DataTransferHubModal({ 
  isOpen, 
  onClose, 
  onSelectImport, 
  onSelectExport,
  targetLabel
}: DataTransferHubProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface rounded-xl p-6 max-w-sm w-full shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {targetLabel}: Transférer
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg p-2">✕</button>
        </div>

        <p className="text-muted text-sm mb-6">
          Veuillez choisir l&apos;opération à effectuer sur votre {targetLabel.toLowerCase()}.
        </p>

        <div className="space-y-4">
          <button
            onClick={onSelectImport}
            className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-3 rounded-lg transition shadow-md flex items-center justify-center gap-3"
          >
            Importer des Cartes
          </button>
          
          <button
            onClick={onSelectExport}
            className="w-full bg-secondary hover:bg-border text-foreground font-bold py-3 rounded-lg transition shadow-sm flex items-center justify-center gap-3"
          >
            Exporter les Données
          </button>
        </div>
      </div>
    </div>
  );
}