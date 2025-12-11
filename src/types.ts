export interface ExchangeData {
  authority: string
  feeBasisPoints: number
  totalVolume: number
  totalFeesCollected: number
  isPaused: boolean
}

export interface TradingPairData {
  exchange: string
  baseMint: string
  quoteMint: string
  baseVault: string
  quoteVault: string
  pairId: number
  baseReserve: number
  quoteReserve: number
  totalVolume: number
  isActive: boolean
}

export interface OrderData {
  user: string
  pair: string
  orderType: "limit" | "market"
  side: "buy" | "sell"
  amount: number
  filledAmount: number
  price: number
  timestamp: number
  isActive: boolean
}

export interface SwapQuote {
  inputAmount: number
  outputAmount: number
  priceImpact: number
  fee: number
  minimumReceived: number
}
