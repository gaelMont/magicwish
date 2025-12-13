// lib/validators.ts
import { z } from 'zod';

// Schéma complet d'une carte (basé sur ton CardType)
export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  imageBackUrl: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  price: z.number().min(0).default(0),
  customPrice: z.number().min(0).optional(),
  setName: z.string().default(''),
  setCode: z.string().default(''),
  isFoil: z.boolean().default(false),
  isSpecificVersion: z.boolean().default(false),
  
  // Remplacement de isForTrade par quantityForTrade
  quantityForTrade: z.number().int().min(0).default(0).optional(), 
  
  wishlistId: z.string().nullable().optional(),
  lastPriceUpdate: z.union([z.number(), z.date()]).optional(), 
  scryfallData: z.record(z.string(), z.unknown()).nullable().optional()
});

// Schéma pour l'exécution d'un échange
export const TradeExecutionSchema = z.object({
  tradeId: z.string().min(1),
  senderUid: z.string().min(1),
  receiverUid: z.string().min(1),
  itemsGiven: z.array(CardSchema),
  itemsReceived: z.array(CardSchema)
});

// Type déduit automatiquement pour l'usage dans TypeScript
export type ValidatedCard = z.infer<typeof CardSchema>;