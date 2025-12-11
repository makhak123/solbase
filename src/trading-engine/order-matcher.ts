import type { PublicKey } from "@solana/web3.js"
import type { SolbaseSDK } from "../solbase-sdk"

interface Order {
  id: string
  user: PublicKey
  pair: PublicKey
  side: "buy" | "sell"
  price: number
  amount: number
  filledAmount: number
  timestamp: number
}

export class OrderMatcher {
  private buyOrders: Map<string, Order[]> = new Map()
  private sellOrders: Map<string, Order[]> = new Map()
  private sdk: SolbaseSDK

  constructor(sdk: SolbaseSDK) {
    this.sdk = sdk
  }

  /**
   * Add order to the order book
   */
  addOrder(order: Order) {
    const pairKey = order.pair.toString()

    if (order.side === "buy") {
      if (!this.buyOrders.has(pairKey)) {
        this.buyOrders.set(pairKey, [])
      }
      this.buyOrders.get(pairKey)!.push(order)
      this.buyOrders.get(pairKey)!.sort((a, b) => b.price - a.price) // Highest first
    } else {
      if (!this.sellOrders.has(pairKey)) {
        this.sellOrders.set(pairKey, [])
      }
      this.sellOrders.get(pairKey)!.push(order)
      this.sellOrders.get(pairKey)!.sort((a, b) => a.price - b.price) // Lowest first
    }

    this.matchOrders(pairKey)
  }

  /**
   * Match orders for a trading pair
   */
  private matchOrders(pairKey: string) {
    const buyOrders = this.buyOrders.get(pairKey) || []
    const sellOrders = this.sellOrders.get(pairKey) || []

    while (buyOrders.length > 0 && sellOrders.length > 0) {
      const buyOrder = buyOrders[0]
      const sellOrder = sellOrders[0]

      // Check if orders can be matched
      if (buyOrder.price >= sellOrder.price) {
        const matchPrice = sellOrder.price // Taker gets maker price
        const matchAmount = Math.min(buyOrder.amount - buyOrder.filledAmount, sellOrder.amount - sellOrder.filledAmount)

        // Execute the trade
        this.executeTrade(buyOrder, sellOrder, matchPrice, matchAmount)

        // Update filled amounts
        buyOrder.filledAmount += matchAmount
        sellOrder.filledAmount += matchAmount

        // Remove fully filled orders
        if (buyOrder.filledAmount >= buyOrder.amount) {
          buyOrders.shift()
        }
        if (sellOrder.filledAmount >= sellOrder.amount) {
          sellOrders.shift()
        }
      } else {
        break // No more matches possible
      }
    }
  }

  /**
   * Execute a trade between two orders
   */
  private async executeTrade(buyOrder: Order, sellOrder: Order, price: number, amount: number) {
    console.log(`[Solbase] Executing trade:`)
    console.log(`  Buy Order: ${buyOrder.id}`)
    console.log(`  Sell Order: ${sellOrder.id}`)
    console.log(`  Price: ${price}`)
    console.log(`  Amount: ${amount}`)
    console.log(`  Total: ${price * amount}`)

    // In production, this would execute on-chain transactions
    // For now, we log the match
  }

  /**
   * Get order book for a pair
   */
  getOrderBook(pairKey: string) {
    return {
      bids: (this.buyOrders.get(pairKey) || []).map((o) => ({
        price: o.price,
        amount: o.amount - o.filledAmount,
        total: o.price * (o.amount - o.filledAmount),
      })),
      asks: (this.sellOrders.get(pairKey) || []).map((o) => ({
        price: o.price,
        amount: o.amount - o.filledAmount,
        total: o.price * (o.amount - o.filledAmount),
      })),
    }
  }

  /**
   * Get market depth
   */
  getMarketDepth(pairKey: string, levels = 10) {
    const orderBook = this.getOrderBook(pairKey)

    return {
      bids: orderBook.bids.slice(0, levels),
      asks: orderBook.asks.slice(0, levels),
      spread: orderBook.asks[0] && orderBook.bids[0] ? orderBook.asks[0].price - orderBook.bids[0].price : 0,
    }
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: string, pairKey: string, side: "buy" | "sell") {
    const orders = side === "buy" ? this.buyOrders.get(pairKey) : this.sellOrders.get(pairKey)

    if (orders) {
      const index = orders.findIndex((o) => o.id === orderId)
      if (index !== -1) {
        orders.splice(index, 1)
        return true
      }
    }
    return false
  }
}
