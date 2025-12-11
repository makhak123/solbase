# Solbase Deployment Guide

## Pre-Deployment

### 1. Environment Setup

\`\`\`bash
# Set Solana cluster
solana config set --url https://api.devnet.solana.com

# Check wallet balance
solana balance

# Request devnet airdrop if needed
solana airdrop 2
\`\`\`

### 2. Update Program ID

After initial build, update the program ID:

\`\`\`bash
# Get program ID
anchor keys list

# Update in:
# - Anchor.toml
# - programs/solbase-dex/src/lib.rs (declare_id!)
# - src/solbase-sdk.ts (PROGRAM_ID)
\`\`\`

### 3. Build

\`\`\`bash
anchor build
\`\`\`

## Deployment Steps

### Devnet Deployment

\`\`\`bash
# Deploy program
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show <PROGRAM_ID>
\`\`\`

### Mainnet Deployment

\`\`\`bash
# Switch to mainnet
solana config set --url https://api.mainnet-beta.solana.com

# Ensure sufficient SOL for deployment (~5 SOL)
solana balance

# Deploy
anchor deploy --provider.cluster mainnet

# Verify
solana program show <PROGRAM_ID>
\`\`\`

## Post-Deployment

### 1. Initialize Exchange

\`\`\`bash
# Run initialization script
ts-node scripts/initialize.ts
\`\`\`

### 2. Create Trading Pairs

\`\`\`bash
# Create SOL/USDC pair
ts-node scripts/create-pair.ts --base SOL --quote USDC
\`\`\`

### 3. Start Services

\`\`\`bash
# Start API server
npm run start:api

# Start trading engine (separate process)
ts-node src/trading-engine/start.ts
\`\`\`

### 4. Monitoring

- Set up uptime monitoring
- Configure alerting
- Monitor transaction fees
- Track program account rent

## Upgrade Process

\`\`\`bash
# Build new version
anchor build

# Deploy upgrade
anchor upgrade <PROGRAM_ID> target/deploy/solbase_dex.so --provider.cluster mainnet

# Verify upgrade
solana program show <PROGRAM_ID>
\`\`\`

## Rollback

If issues occur:

\`\`\`bash
# Redeploy previous version
anchor deploy --program-keypair <backup-keypair> --provider.cluster mainnet
\`\`\`

## Security Checklist

- [ ] Audit smart contracts
- [ ] Test all functions on devnet
- [ ] Verify program authority
- [ ] Check fee calculations
- [ ] Test emergency pause
- [ ] Backup all keypairs securely
- [ ] Set up monitoring alerts
- [ ] Document admin procedures

## Cost Estimates

**Devnet:**
- Free (airdrop available)

**Mainnet:**
- Program deployment: ~4-5 SOL
- Account initialization: ~0.01 SOL each
- Transaction fees: ~0.00001 SOL each

## Maintenance

Regular tasks:
- Monitor program account rent
- Check for security updates
- Update dependencies
- Review transaction logs
- Optimize gas usage
