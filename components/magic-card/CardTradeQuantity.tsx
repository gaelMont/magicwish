'use client';

type Props = {
    quantity: number;
    tradeQty: number;
    onIncrementTrade?: () => void;
    onDecrementTrade?: () => void;
};

export default function CardTradeQuantity({ quantity, tradeQty, onIncrementTrade, onDecrementTrade }: Props) {
    return (
        <div className="flex items-center bg-success/10 border border-success/20 rounded-sm p-px h-5">
            <button 
                onClick={(e) => {e.stopPropagation(); onDecrementTrade?.()}} 
                disabled={tradeQty <= 0}
                className="w-3.5 h-full hover:bg-success/20 text-success/70 hover:text-success rounded-xs flex items-center justify-center text-[10px] font-bold transition leading-none disabled:opacity-30" 
            >
                -
            </button>
            
            <span className="text-[10px] leading-none flex items-center justify-center h-full px-1 font-bold text-success min-w-3">
                {tradeQty}
            </span>

            <button 
                onClick={(e) => {e.stopPropagation(); onIncrementTrade?.()}} 
                disabled={tradeQty >= quantity}
                className="w-3.5 h-full hover:bg-success/20 text-success/70 hover:text-success rounded-xs flex items-center justify-center text-[10px] font-bold transition leading-none disabled:opacity-30" 
            >
                +
            </button>
        </div>
    );
}