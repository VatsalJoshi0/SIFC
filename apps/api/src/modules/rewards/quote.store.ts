/**
 * In-memory Quote Store with 15-minute TTL (TRD 10.4).
 * Quotes lock category, discount and fee values for 15 minutes.
 */

export interface LockedQuote {
  quoteId: string;
  userId: string;
  serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
  vehicleId: string | null;
  licenceId: string | null;
  providerId: string;
  vaiCategory: "FAIR" | "GOOD" | "VERY_GOOD";
  baseAmountPaise: bigint;
  discountBps: number;
  discountPaise: bigint;
  govtFundedPaise: bigint;
  payablePaise: bigint;
  platformFeeOptionCode: string;
  platformFeePpm: number;
  platformFeePaise: bigint;
  feeMode: "PROVIDER_PAYS" | "PASS_THROUGH";
  userTotalPaise: bigint;
  settlementToProviderPaise: bigint;
  quoteExpiresAt: Date;
  createdAt: Date;
}

export class QuoteStore {
  private quotes = new Map<string, LockedQuote>();

  saveQuote(quote: LockedQuote): void {
    this.quotes.set(quote.quoteId, quote);
  }

  getQuote(quoteId: string): { quote: LockedQuote | null; isExpired: boolean } {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      return { quote: null, isExpired: false };
    }

    if (Date.now() > quote.quoteExpiresAt.getTime()) {
      return { quote, isExpired: true };
    }

    return { quote, isExpired: false };
  }

  invalidateQuote(quoteId: string): void {
    this.quotes.delete(quoteId);
  }

  clear(): void {
    this.quotes.clear();
  }
}

export const quoteStore = new QuoteStore();
