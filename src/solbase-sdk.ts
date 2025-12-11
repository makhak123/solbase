import { type Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor"
import { IDL } from "./idl"

const PROGRAM_ID = new PublicKey("SoLBase11111111111111111111111111111111111")

export class SolbaseSDK {
  private connection: Connection
  private program: Program
  private provider: AnchorProvider

  constructor(connection: Connection, wallet: any) {
    this.connection = connection
    this.provider = new AnchorProvider(connection, wallet, {})
    this.program = new Program(IDL, PROGRAM_ID, this.provider)
  }

  /**
   * Get the exchange PDA address
   */
  async getExchangeAddress(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress([Buffer.from("exchange")], PROGRAM_ID)
  }

  /**
   * Get trading pair PDA address
   */
  async getPairAddress(baseMint: PublicKey, quoteMint: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress([Buffer.from("pair"), baseMint.toBuffer(), quoteMint.toBuffer()], PROGRAM_ID)
  }

  /**
   * Initialize the exchange
   */
  async initializeExchange(authority: Keypair, feeBasisPoints: number): Promise<string> {
    const [exchangeAddress] = await this.getExchangeAddress()

    const tx = await this.program.methods
      .initializeExchange(feeBasisPoints)
      .accounts({
        exchange: exchangeAddress,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    return tx
  }

  /**
   * Create a new trading pair
   */
  async createPair(
    authority: Keypair,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey,
    pairId: number,
  ): Promise<string> {
    const [exchangeAddress] = await this.getExchangeAddress()
    const [pairAddress] = await this.getPairAddress(baseMint, quoteMint)

    const tx = await this.program.methods
      .createPair(new BN(pairId))
      .accounts({
        exchange: exchangeAddress,
        pair: pairAddress,
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    return tx
  }

  /**
   * Place a limit order
   */
  async placeOrder(
    user: Keypair,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    orderType: "limit" | "market",
    side: "buy" | "sell",
    amount: number,
    price: number,
  ): Promise<string> {
    const [exchangeAddress] = await this.getExchangeAddress()
    const [pairAddress] = await this.getPairAddress(baseMint, quoteMint)

    const orderAccount = Keypair.generate()
    const userTokenAccount = await getAssociatedTokenAddress(side === "buy" ? quoteMint : baseMint, user.publicKey)

    const exchange = await this.program.account.exchange.fetch(exchangeAddress)
    const pair = await this.program.account.tradingPair.fetch(pairAddress)

    const tx = await this.program.methods
      .placeOrder(
        orderType === "limit" ? { limit: {} } : { market: {} },
        side === "buy" ? { buy: {} } : { sell: {} },
        new BN(amount),
        new BN(price),
      )
      .accounts({
        exchange: exchangeAddress,
        pair: pairAddress,
        order: orderAccount.publicKey,
        user: user.publicKey,
        userTokenAccount,
        baseVault: pair.baseVault,
        quoteVault: pair.quoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user, orderAccount])
      .rpc()

    return tx
  }

  /**
   * Execute a swap
   */
  async swap(
    user: Keypair,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    isBaseToQuote: boolean,
  ): Promise<string> {
    const [exchangeAddress] = await this.getExchangeAddress()
    const [pairAddress] = await this.getPairAddress(baseMint, quoteMint)

    const pair = await this.program.account.tradingPair.fetch(pairAddress)

    const userSource = await getAssociatedTokenAddress(isBaseToQuote ? baseMint : quoteMint, user.publicKey)
    const userDestination = await getAssociatedTokenAddress(isBaseToQuote ? quoteMint : baseMint, user.publicKey)

    const tx = await this.program.methods
      .swap(new BN(amountIn), new BN(minimumAmountOut))
      .accounts({
        exchange: exchangeAddress,
        pair: pairAddress,
        user: user.publicKey,
        userSource,
        userDestination,
        vaultSource: isBaseToQuote ? pair.baseVault : pair.quoteVault,
        vaultDestination: isBaseToQuote ? pair.quoteVault : pair.baseVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc()

    return tx
  }

  /**
   * Cancel an order
   */
  async cancelOrder(user: Keypair, orderAddress: PublicKey): Promise<string> {
    const [exchangeAddress] = await this.getExchangeAddress()
    const order = await this.program.account.order.fetch(orderAddress)
    const pair = await this.program.account.tradingPair.fetch(order.pair)

    const userTokenAccount = await getAssociatedTokenAddress(
      order.side === "buy" ? pair.quoteMint : pair.baseMint,
      user.publicKey,
    )

    const tx = await this.program.methods
      .cancelOrder()
      .accounts({
        exchange: exchangeAddress,
        order: orderAddress,
        user: user.publicKey,
        userTokenAccount,
        vault: order.side === "buy" ? pair.quoteVault : pair.baseVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc()

    return tx
  }

  /**
   * Get exchange data
   */
  async getExchange() {
    const [exchangeAddress] = await this.getExchangeAddress()
    return this.program.account.exchange.fetch(exchangeAddress)
  }

  /**
   * Get trading pair data
   */
  async getPair(baseMint: PublicKey, quoteMint: PublicKey) {
    const [pairAddress] = await this.getPairAddress(baseMint, quoteMint)
    return this.program.account.tradingPair.fetch(pairAddress)
  }

  /**
   * Get order data
   */
  async getOrder(orderAddress: PublicKey) {
    return this.program.account.order.fetch(orderAddress)
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(userPublicKey: PublicKey) {
    return this.program.account.order.all([
      {
        memcmp: {
          offset: 8,
          bytes: userPublicKey.toBase58(),
        },
      },
    ])
  }

  /**
   * Get all trading pairs
   */
  async getAllPairs() {
    return this.program.account.tradingPair.all()
  }
}

export * from "./types"
