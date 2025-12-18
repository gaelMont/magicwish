'use client';

type Props = {
    quantity: number;
    readOnly?: boolean;
    onIncrement?: () => void;
    onDecrement?: () => void;
};

export default function CardQuantity({ quantity, readOnly, onIncrement, onDecrement }: Props) {
    return (
        <div className="flex items-center bg-secondary rounded-sm p-px border border-border h-5">
            {!readOnly && (
                <button 
                    onClick={(e) => {e.stopPropagation(); onDecrement?.()}} 
                    className="w-3.5 h-full hover:bg-border text-muted hover:text-foreground rounded-xs flex items-center justify-center text-[10px] font-bold transition leading-none"
                >
                    -
                </button>
            )}
            
            <span className="text-[10px] leading-none flex items-center justify-center h-full px-1 font-bold text-foreground min-w-3">
                {quantity}
            </span>

            {!readOnly && (
                <button 
                    onClick={(e) => {e.stopPropagation(); onIncrement?.()}} 
                    className="w-3.5 h-full bg-primary/10 hover:bg-primary/20 text-primary rounded-xs flex items-center justify-center text-[10px] font-bold transition leading-none"
                >
                    +
                </button>
            )}
        </div>
    );
}