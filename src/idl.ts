export const IDL = {
  version: "0.1.0",
  name: "solbase_dex",
  instructions: [
    {
      name: "initializeExchange",
      accounts: [
        { name: "exchange", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "feeBasisPoints", type: "u16" }],
    },
    {
      name: "createPair",
      accounts: [
        { name: "exchange", isMut: true, isSigner: false },
        { name: "pair", isMut: true, isSigner: false },
        { name: "baseMint", isMut: false, isSigner: false },
        { name: "quoteMint", isMut: false, isSigner: false },
        { name: "baseVault", isMut: false, isSigner: false },
        { name: "quoteVault", isMut: false, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "pairId", type: "u64" }],
    },
    {
      name: "placeOrder",
      accounts: [
        { name: "exchange", isMut: false, isSigner: false },
        { name: "pair", isMut: true, isSigner: false },
        { name: "order", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "baseVault", isMut: true, isSigner: false },
        { name: "quoteVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "orderType", type: { defined: "OrderType" } },
        { name: "side", type: { defined: "OrderSide" } },
        { name: "amount", type: "u64" },
        { name: "price", type: "u64" },
      ],
    },
    {
      name: "swap",
      accounts: [
        { name: "exchange", isMut: true, isSigner: false },
        { name: "pair", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userSource", isMut: true, isSigner: false },
        { name: "userDestination", isMut: true, isSigner: false },
        { name: "vaultSource", isMut: true, isSigner: false },
        { name: "vaultDestination", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amountIn", type: "u64" },
        { name: "minimumAmountOut", type: "u64" },
      ],
    },
    {
      name: "cancelOrder",
      accounts: [
        { name: "exchange", isMut: false, isSigner: false },
        { name: "order", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Exchange",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "feeBasisPoints", type: "u16" },
          { name: "totalVolume", type: "u64" },
          { name: "totalFeesCollected", type: "u64" },
          { name: "isPaused", type: "bool" },
        ],
      },
    },
    {
      name: "TradingPair",
      type: {
        kind: "struct",
        fields: [
          { name: "exchange", type: "publicKey" },
          { name: "baseMint", type: "publicKey" },
          { name: "quoteMint", type: "publicKey" },
          { name: "baseVault", type: "publicKey" },
          { name: "quoteVault", type: "publicKey" },
          { name: "pairId", type: "u64" },
          { name: "baseReserve", type: "u64" },
          { name: "quoteReserve", type: "u64" },
          { name: "totalVolume", type: "u64" },
          { name: "isActive", type: "bool" },
        ],
      },
    },
    {
      name: "Order",
      type: {
        kind: "struct",
        fields: [
          { name: "user", type: "publicKey" },
          { name: "pair", type: "publicKey" },
          { name: "orderType", type: { defined: "OrderType" } },
          { name: "side", type: { defined: "OrderSide" } },
          { name: "amount", type: "u64" },
          { name: "filledAmount", type: "u64" },
          { name: "price", type: "u64" },
          { name: "timestamp", type: "i64" },
          { name: "isActive", type: "bool" },
        ],
      },
    },
  ],
  types: [
    {
      name: "OrderType",
      type: {
        kind: "enum",
        variants: [{ name: "Limit" }, { name: "Market" }],
      },
    },
    {
      name: "OrderSide",
      type: {
        kind: "enum",
        variants: [{ name: "Buy" }, { name: "Sell" }],
      },
    },
  ],
  errors: [
    { code: 6000, name: "ExchangePaused", msg: "Exchange is paused" },
    { code: 6001, name: "PairInactive", msg: "Trading pair is inactive" },
    { code: 6002, name: "InvalidAmount", msg: "Invalid amount" },
    { code: 6003, name: "InvalidPrice", msg: "Invalid price" },
    { code: 6004, name: "SlippageExceeded", msg: "Slippage tolerance exceeded" },
    { code: 6005, name: "OrderNotActive", msg: "Order is not active" },
    { code: 6006, name: "Unauthorized", msg: "Unauthorized" },
  ],
}
