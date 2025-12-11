import * as anchor from "@coral-xyz/anchor"
import type { Program } from "@coral-xyz/anchor"
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token"
import { assert } from "chai"
import type { SolbaseDex } from "../target/types/solbase_dex"

describe("Solbase DEX Tests", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.SolbaseDex as Program<SolbaseDex>

  let authority: Keypair
  let baseMint: PublicKey
  let quoteMint: PublicKey
  let exchangeAddress: PublicKey
  let pairAddress: PublicKey

  const before = async () => {
    authority = Keypair.generate()

    // Airdrop SOL to authority
    const signature = await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
    await provider.connection.confirmTransaction(signature)

    // Create test tokens
    baseMint = await createMint(provider.connection, authority, authority.publicKey, null, 9)

    quoteMint = await createMint(provider.connection, authority, authority.publicKey, null, 6)

    // Derive PDAs
    ;[exchangeAddress] = PublicKey.findProgramAddressSync([Buffer.from("exchange")], program.programId)
    ;[pairAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("pair"), baseMint.toBuffer(), quoteMint.toBuffer()],
      program.programId,
    )
  }

  it("Initializes the exchange", async () => {
    const feeBasisPoints = 30 // 0.3% fee

    await program.methods
      .initializeExchange(feeBasisPoints)
      .accounts({
        exchange: exchangeAddress,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    const exchange = await program.account.exchange.fetch(exchangeAddress)

    assert.equal(exchange.feeBasisPoints, feeBasisPoints)
    assert.equal(exchange.authority.toString(), authority.publicKey.toString())
    assert.equal(exchange.isPaused, false)
    console.log("✅ Exchange initialized successfully")
  })

  it("Creates a trading pair", async () => {
    const baseVault = await createAccount(provider.connection, authority, baseMint, exchangeAddress)

    const quoteVault = await createAccount(provider.connection, authority, quoteMint, exchangeAddress)

    await program.methods
      .createPair(new anchor.BN(1))
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

    const pair = await program.account.tradingPair.fetch(pairAddress)

    assert.equal(pair.baseMint.toString(), baseMint.toString())
    assert.equal(pair.quoteMint.toString(), quoteMint.toString())
    assert.equal(pair.isActive, true)
    console.log("✅ Trading pair created successfully")
  })

  it("Places a buy order", async () => {
    const user = Keypair.generate()

    // Airdrop and setup
    const sig = await provider.connection.requestAirdrop(user.publicKey, anchor.web3.LAMPORTS_PER_SOL)
    await provider.connection.confirmTransaction(sig)

    const userQuoteAccount = await createAccount(provider.connection, user, quoteMint, user.publicKey)

    await mintTo(
      provider.connection,
      user,
      quoteMint,
      userQuoteAccount,
      authority,
      1000_000000, // 1000 USDC
    )

    const order = Keypair.generate()
    const pair = await program.account.tradingPair.fetch(pairAddress)

    await program.methods
      .placeOrder(
        { limit: {} },
        { buy: {} },
        new anchor.BN(100_000000000), // 100 base tokens
        new anchor.BN(50_000000), // $50 per token
      )
      .accounts({
        exchange: exchangeAddress,
        pair: pairAddress,
        order: order.publicKey,
        user: user.publicKey,
        userTokenAccount: userQuoteAccount,
        baseVault: pair.baseVault,
        quoteVault: pair.quoteVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user, order])
      .rpc()

    const orderAccount = await program.account.order.fetch(order.publicKey)

    assert.equal(orderAccount.isActive, true)
    assert.equal(orderAccount.amount.toString(), "100000000000")
    console.log("✅ Buy order placed successfully")
  })
})
