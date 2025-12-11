export class LiquidityPool {
  private baseReserve: number
  private quoteReserve: number
  private totalShares: number
  private lpShares: Map<string, number> = new Map()

  constructor(baseReserve = 0, quoteReserve = 0) {
    this.baseReserve = baseReserve
    this.quoteReserve = quoteReserve
    this.totalShares = 0
  }

  /**
   * Add liquidity to the pool
   */
  addLiquidity(provider: string, baseAmount: number, quoteAmount: number): number {
    let shares: number

    if (this.totalShares === 0) {
      // Initial liquidity
      shares = Math.sqrt(baseAmount * quoteAmount)
      this.totalShares = shares
    } else {
      // Calculate proportional shares
      const shareFromBase = (baseAmount * this.totalShares) / this.baseReserve
      const shareFromQuote = (quoteAmount * this.totalShares) / this.quoteReserve
      shares = Math.min(shareFromBase, shareFromQuote)
      this.totalShares += shares
    }

    this.baseReserve += baseAmount
    this.quoteReserve += quoteAmount

    const currentShares = this.lpShares.get(provider) || 0
    this.lpShares.set(provider, currentShares + shares)

    return shares
  }

  /**
   * Remove liquidity from the pool
   */
  removeLiquidity(provider: string, shares: number): [number, number] {
    const currentShares = this.lpShares.get(provider) || 0
    if (currentShares < shares) {
      throw new Error("Insufficient shares")
    }

    const baseAmount = (shares * this.baseReserve) / this.totalShares
    const quoteAmount = (shares * this.quoteReserve) / this.totalShares

    this.baseReserve -= baseAmount
    this.quoteReserve -= quoteAmount
    this.totalShares -= shares
    this.lpShares.set(provider, currentShares - shares)

    return [baseAmount, quoteAmount]
  }

  /**
   * Calculate swap output using constant product formula (x * y = k)
   */
  calculateSwapOutput(inputAmount: number, isBaseToQuote: boolean, feeBasisPoints = 30): number {
    const fee = (inputAmount * feeBasisPoints) / 10000
    const inputWithFee = inputAmount - fee

    if (isBaseToQuote) {
      return (inputWithFee * this.quoteReserve) / (this.baseReserve + inputWithFee)
    } else {
      return (inputWithFee * this.baseReserve) / (this.quoteReserve + inputWithFee)
    }
  }

  /**
   * Execute a swap
   */
  executeSwap(inputAmount: number, isBaseToQuote: boolean, feeBasisPoints = 30): number {
    const outputAmount = this.calculateSwapOutput(inputAmount, isBaseToQuote, feeBasisPoints)

    if (isBaseToQuote) {
      this.baseReserve += inputAmount
      this.quoteReserve -= outputAmount
    } else {
      this.quoteReserve += inputAmount
      this.baseReserve -= outputAmount
    }

    return outputAmount
  }

  /**
   * Get current price
   */
  getPrice(isBaseToQuote: boolean): number {
    if (isBaseToQuote) {
      return this.quoteReserve / this.baseReserve
    } else {
      return this.baseReserve / this.quoteReserve
    }
  }

  /**
   * Calculate price impact
   */
  calculatePriceImpact(inputAmount: number, isBaseToQuote: boolean): number {
    const currentPrice = this.getPrice(isBaseToQuote)
    const outputAmount = this.calculateSwapOutput(inputAmount, isBaseToQuote, 0)
    const effectivePrice = outputAmount / inputAmount

    return ((effectivePrice - currentPrice) / currentPrice) * 100
  }

  /**
   * Get pool stats
   */
  getStats() {
    return {
      baseReserve: this.baseReserve,
      quoteReserve: this.quoteReserve,
      totalShares: this.totalShares,
      totalValueLocked: this.baseReserve + this.quoteReserve,
      price: this.getPrice(true),
    }
  }
}
