// components/ColumnSlider.tsx
'use client';

type Props = {
    columns: number;
    setColumns: (val: number) => void;
    min?: number;
    max?: number;
};

export default function ColumnSlider({ columns, setColumns, min = 2, max = 10 }: Props) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-surface border border-border px-3 py-2 rounded-lg shadow-sm">
            <span className="text-[10px] uppercase font-bold text-muted whitespace-nowrap">
                Colonnes : <span className="text-primary">{columns}</span>
            </span>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={columns} 
                onChange={(e) => setColumns(parseInt(e.target.value))}
                className="w-24 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                title="Ajuster le nombre de colonnes"
            />
        </div>
    );
}