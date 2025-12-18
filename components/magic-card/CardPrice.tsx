'use client';

type Props = {
    displayPriceString: string;
    hasPrice: boolean;
    isFoil?: boolean; // Ajouté pour compatibilité future si besoin
};

export default function CardPrice({ displayPriceString, hasPrice }: Props) {
    return (
        <p className={`font-bold text-[10px] whitespace-nowrap leading-none ${!hasPrice ? 'text-muted italic' : 'text-foreground'}`}>
            {displayPriceString}
        </p>
    );
}