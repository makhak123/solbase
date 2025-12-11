import express from "express"
import cors from "cors"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import { SolbaseSDK } from "../solbase-sdk"

const app = express()
app.use(cors())
app.use(express.json())

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"
const connection = new Connection(RPC_ENDPOINT, "confirmed")

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", network: "solana-devnet" })
})

// Get exchange info
app.get("/api/exchange", async (req, res) => {
  try {
    const wallet = Keypair.generate() // Admin wallet
    const sdk = new SolbaseSDK(connection, wallet)
    const exchange = await sdk.getExchange()

    res.json({
      authority: exchange.authority.toString(),
      feeBasisPoints: exchange.feeBasisPoints,
      totalVolume: exchange.totalVolume.toString(),
      totalFeesCollected: exchange.totalFeesCollected.toString(),
      isPaused: exchange.isPaused,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get all trading pairs
app.get("/api/pairs", async (req, res) => {
  try {
    const wallet = Keypair.generate()
    const sdk = new SolbaseSDK(connection, wallet)
    const pairs = await sdk.getAllPairs()

    res.json(
      pairs.map((p) => ({
        address: p.publicKey.toString(),
        baseMint: p.account.baseMint.toString(),
        quoteMint: p.account.quoteMint.toString(),
        baseReserve: p.account.baseReserve.toString(),
        quoteReserve: p.account.quoteReserve.toString(),
        totalVolume: p.account.totalVolume.toString(),
        isActive: p.account.isActive,
      })),
    )
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get specific pair
app.get("/api/pairs/:base/:quote", async (req, res) => {
  try {
    const wallet = Keypair.generate()
    const sdk = new SolbaseSDK(connection, wallet)

    const baseMint = new PublicKey(req.params.base)
    const quoteMint = new PublicKey(req.params.quote)

    const pair = await sdk.getPair(baseMint, quoteMint)

    res.json({
      baseMint: pair.baseMint.toString(),
      quoteMint: pair.quoteMint.toString(),
      baseReserve: pair.baseReserve.toString(),
      quoteReserve: pair.quoteReserve.toString(),
      price: (pair.quoteReserve / pair.baseReserve).toFixed(6),
      totalVolume: pair.totalVolume.toString(),
      isActive: pair.isActive,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user orders
app.get("/api/orders/:userAddress", async (req, res) => {
  try {
    const wallet = Keypair.generate()
    const sdk = new SolbaseSDK(connection, wallet)

    const userPublicKey = new PublicKey(req.params.userAddress)
    const orders = await sdk.getUserOrders(userPublicKey)

    res.json(
      orders.map((o) => ({
        address: o.publicKey.toString(),
        pair: o.account.pair.toString(),
        side: o.account.side,
        amount: o.account.amount.toString(),
        filledAmount: o.account.filledAmount.toString(),
        price: o.account.price.toString(),
        timestamp: o.account.timestamp.toString(),
        isActive: o.account.isActive,
      })),
    )
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get swap quote
app.post("/api/quote", async (req, res) => {
  try {
    const { baseMint, quoteMint, amountIn, slippage = 0.5 } = req.body

    const wallet = Keypair.generate()
    const sdk = new SolbaseSDK(connection, wallet)

    const pair = await sdk.getPair(new PublicKey(baseMint), new PublicKey(quoteMint))

    const exchange = await sdk.getExchange()

    // Calculate output using constant product formula
    const fee = (amountIn * exchange.feeBasisPoints) / 10000
    const amountInWithFee = amountIn - fee

    const reservesIn = Number(pair.baseReserve)
    const reservesOut = Number(pair.quoteReserve)

    const amountOut = (amountInWithFee * reservesOut) / (reservesIn + amountInWithFee)
    const priceImpact = ((amountInWithFee / reservesIn) * 100).toFixed(2)
    const minimumReceived = amountOut * (1 - slippage / 100)

    res.json({
      inputAmount: amountIn,
      outputAmount: amountOut,
      priceImpact: Number.parseFloat(priceImpact),
      fee,
      minimumReceived,
      price: (amountOut / amountIn).toFixed(6),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get market data
app.get("/api/markets", async (req, res) => {
  try {
    const wallet = Keypair.generate()
    const sdk = new SolbaseSDK(connection, wallet)
    const pairs = await sdk.getAllPairs()

    const markets = pairs
      .filter((p) => p.account.isActive)
      .map((p) => ({
        symbol: `${p.account.baseMint.toString().slice(0, 4)}/${p.account.quoteMint.toString().slice(0, 4)}`,
        baseMint: p.account.baseMint.toString(),
        quoteMint: p.account.quoteMint.toString(),
        price: (Number(p.account.quoteReserve) / Number(p.account.baseReserve)).toFixed(6),
        volume24h: p.account.totalVolume.toString(),
        liquidity: (Number(p.account.baseReserve) + Number(p.account.quoteReserve)).toString(),
      }))

    res.json(markets)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Solbase API running on port ${PORT}`)
  console.log(`📡 Connected to: ${RPC_ENDPOINT}`)
})
