# Solbase

**Solbase** is a production-ready decentralized exchange (DEX) built on Solana. It's a complete Coinbase fork optimized for Solana's high-speed blockchain.

CA: 6KWtq1Uz1ZshFPg6WJdGr4ZjN3WCgzJyvPGfx1q1pump

## Features

✅ **Solana Smart Contracts** - Full-featured DEX program written in Rust/Anchor  
✅ **Order Book Trading** - Limit orders, market orders, order matching  
✅ **Automated Market Maker (AMM)** - Constant product liquidity pools  
✅ **Token Swaps** - Fast, low-fee token swapping with slippage protection  
✅ **Liquidity Provision** - Add/remove liquidity and earn fees  
✅ **Trading Engine** - Off-chain order matching and execution  
✅ **REST API** - Complete API for market data and trading operations  
✅ **TypeScript SDK** - Easy integration for developers  

## Architecture

\`\`\`
solbase/
├── programs/
│   └── solbase-dex/         # Rust smart contracts
├── src/
│   ├── solbase-sdk.ts       # TypeScript SDK
│   ├── api/                 # REST API server
│   ├── trading-engine/      # Order matching engine
│   └── types.ts             # TypeScript definitions
├── tests/                   # Test suite
└── Anchor.toml              # Anchor configuration
\`\`\`

## Quick Start

### Prerequisites

- Rust 1.70+
- Solana CLI 1.17+
- Anchor 0.29+
- Node.js 18+

### Installation

\`\`\`bash
# Install Solana
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

# Install dependencies
npm install
\`\`\`

### Build

\`\`\`bash
# Build the Solana program
anchor build

# Generate TypeScript types
anchor build --idl idl
\`\`\`

### Deploy

\`\`\`bash
# Deploy to Devnet
anchor deploy --provider.cluster devnet

# Deploy to Mainnet
anchor deploy --provider.cluster mainnet
\`\`\`

### Run Tests

\`\`\`bash
# Run all tests
anchor test

# Run specific test
anchor test -- --grep "swap"
\`\`\`

### Start API Server

\`\`\`bash
# Development
npm run dev:api

# Production
npm run start:api
\`\`\`

## Usage

### TypeScript SDK

\`\`\`typescript
import { Connection, Keypair } from '@solana/web3.js';
import { SolbaseSDK } from './src/solbase-sdk';

const connection = new Connection('https://api.devnet.solana.com');
const wallet = Keypair.generate();
const sdk = new SolbaseSDK(connection, wallet);

// Initialize exchange
await sdk.initializeExchange(wallet, 30); // 0.3% fee

// Create trading pair
await sdk.createPair(
  wallet,
  baseMint,
  quoteMint,
  baseVault,
  quoteVault,
  1
);

// Execute swap
await sdk.swap(
  wallet,
  baseMint,
  quoteMint,
  1000000, // amount in
  950000,  // minimum out
  true     // base to quote
);

// Place order
await sdk.placeOrder(
  wallet,
  baseMint,
  quoteMint,
  'limit',
  'buy',
  1000000,
  50000000
);
\`\`\`

### API Endpoints

\`\`\`bash
# Health check
GET /health

# Get exchange info
GET /api/exchange

# Get all trading pairs
GET /api/pairs

# Get specific pair
GET /api/pairs/:base/:quote

# Get user orders
GET /api/orders/:userAddress

# Get swap quote
POST /api/quote

# Get markets
GET /api/markets
\`\`\`

## Smart Contract Functions

### Core Functions

- `initialize_exchange` - Set up the exchange with fee structure
- `create_pair` - Create new trading pair
- `place_order` - Submit limit/market order
- `swap` - Execute instant token swap
- `cancel_order` - Cancel active order

### Security Features

- PDA-based authority control
- Token escrow in program vaults
- Slippage protection
- Order validation
- Emergency pause mechanism

## Trading Engine

The off-chain matching engine provides:

- Real-time order matching
- Price-time priority
- Partial fills
- Market depth calculation
- Order book management

## Liquidity Pools

AMM implementation with:

- Constant product formula (x * y = k)
- LP token distribution
- Fee collection
- Price impact calculation
- Impermanent loss tracking

## Configuration

### Environment Variables

\`\`\`bash
SOLANA_RPC_URL=https://api.devnet.solana.com
PORT=3001
\`\`\`

### Program Configuration

Edit `Anchor.toml` to customize:
- Program ID
- Network endpoints
- Wallet paths

## Testing

Comprehensive test suite covering:

- Exchange initialization
- Pair creation
- Order placement
- Swap execution
- Order cancellation
- Liquidity operations

## Deployment Checklist

- [ ] Build and test on devnet
- [ ] Audit smart contracts
- [ ] Set appropriate fees
- [ ] Configure rate limits
- [ ] Set up monitoring
- [ ] Deploy to mainnet
- [ ] Verify program deployment

## Security

⚠️ **Important Security Considerations:**

1. Always verify token mint addresses
2. Use slippage protection for swaps
3. Validate all user inputs
4. Test thoroughly before mainnet deployment
5. Consider professional security audit

## Performance

Solana's high-performance blockchain enables:

- 65,000+ TPS capacity
- ~400ms block times
- Sub-penny transaction fees
- Parallel transaction execution

## License

MIT License - see LICENSE file

## Support

For issues and questions:
- GitHub Issues
- Discord: [Your Discord]
- Twitter: [@solbase]

---

Built with ⚡ on Solana
