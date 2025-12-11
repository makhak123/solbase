use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("SoLBase11111111111111111111111111111111111");

#[program]
pub mod solbase_dex {
    use super::*;

    /// Initialize the exchange
    pub fn initialize_exchange(
        ctx: Context<InitializeExchange>,
        fee_basis_points: u16,
    ) -> Result<()> {
        let exchange = &mut ctx.accounts.exchange;
        exchange.authority = ctx.accounts.authority.key();
        exchange.fee_basis_points = fee_basis_points;
        exchange.total_volume = 0;
        exchange.total_fees_collected = 0;
        exchange.is_paused = false;
        Ok(())
    }

    /// Create a new trading pair
    pub fn create_pair(
        ctx: Context<CreatePair>,
        pair_id: u64,
    ) -> Result<()> {
        let pair = &mut ctx.accounts.pair;
        pair.exchange = ctx.accounts.exchange.key();
        pair.base_mint = ctx.accounts.base_mint.key();
        pair.quote_mint = ctx.accounts.quote_mint.key();
        pair.base_vault = ctx.accounts.base_vault.key();
        pair.quote_vault = ctx.accounts.quote_vault.key();
        pair.pair_id = pair_id;
        pair.base_reserve = 0;
        pair.quote_reserve = 0;
        pair.total_volume = 0;
        pair.is_active = true;
        Ok(())
    }

    /// Place a limit order
    pub fn place_order(
        ctx: Context<PlaceOrder>,
        order_type: OrderType,
        side: OrderSide,
        amount: u64,
        price: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.exchange.is_paused, ErrorCode::ExchangePaused);
        require!(ctx.accounts.pair.is_active, ErrorCode::PairInactive);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(price > 0, ErrorCode::InvalidPrice);

        let order = &mut ctx.accounts.order;
        order.user = ctx.accounts.user.key();
        order.pair = ctx.accounts.pair.key();
        order.order_type = order_type;
        order.side = side;
        order.amount = amount;
        order.filled_amount = 0;
        order.price = price;
        order.timestamp = Clock::get()?.unix_timestamp;
        order.is_active = true;

        // Transfer tokens from user to vault
        let transfer_amount = match side {
            OrderSide::Buy => (amount * price) / 1_000_000, // Calculate quote token amount
            OrderSide::Sell => amount,
        };

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: match side {
                OrderSide::Buy => ctx.accounts.quote_vault.to_account_info(),
                OrderSide::Sell => ctx.accounts.base_vault.to_account_info(),
            },
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, transfer_amount)?;

        Ok(())
    }

    /// Execute a market swap
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.exchange.is_paused, ErrorCode::ExchangePaused);
        require!(ctx.accounts.pair.is_active, ErrorCode::PairInactive);
        require!(amount_in > 0, ErrorCode::InvalidAmount);

        let pair = &ctx.accounts.pair;
        let exchange = &mut ctx.accounts.exchange;

        // Calculate output amount using constant product formula (x * y = k)
        let fee = (amount_in * exchange.fee_basis_points as u64) / 10_000;
        let amount_in_with_fee = amount_in - fee;

        let reserves_in = pair.base_reserve;
        let reserves_out = pair.quote_reserve;

        let amount_out = (amount_in_with_fee * reserves_out) / (reserves_in + amount_in_with_fee);
        
        require!(amount_out >= minimum_amount_out, ErrorCode::SlippageExceeded);

        // Transfer tokens in
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_source.to_account_info(),
            to: ctx.accounts.vault_source.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_in)?;

        // Transfer tokens out
        let exchange_key = exchange.key();
        let seeds = &[
            b"exchange".as_ref(),
            exchange_key.as_ref(),
            &[ctx.bumps.exchange],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_destination.to_account_info(),
            to: ctx.accounts.user_destination.to_account_info(),
            authority: ctx.accounts.exchange.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount_out)?;

        // Update stats
        exchange.total_volume += amount_in;
        exchange.total_fees_collected += fee;

        Ok(())
    }

    /// Cancel an order
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.is_active, ErrorCode::OrderNotActive);
        require!(order.user == ctx.accounts.user.key(), ErrorCode::Unauthorized);

        order.is_active = false;

        // Return unfilled tokens to user
        let unfilled_amount = order.amount - order.filled_amount;
        if unfilled_amount > 0 {
            let exchange_key = ctx.accounts.exchange.key();
            let seeds = &[
                b"exchange".as_ref(),
                exchange_key.as_ref(),
                &[ctx.bumps.exchange],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.exchange.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, unfilled_amount)?;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeExchange<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Exchange::LEN,
        seeds = [b"exchange"],
        bump
    )]
    pub exchange: Account<'info, Exchange>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePair<'info> {
    #[account(mut)]
    pub exchange: Account<'info, Exchange>,
    #[account(
        init,
        payer = authority,
        space = 8 + TradingPair::LEN,
        seeds = [b"pair", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub pair: Account<'info, TradingPair>,
    pub base_mint: Account<'info, token::Mint>,
    pub quote_mint: Account<'info, token::Mint>,
    pub base_vault: Account<'info, TokenAccount>,
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    pub exchange: Account<'info, Exchange>,
    #[account(mut)]
    pub pair: Account<'info, TradingPair>,
    #[account(
        init,
        payer = user,
        space = 8 + Order::LEN,
    )]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut, seeds = [b"exchange"], bump)]
    pub exchange: Account<'info, Exchange>,
    #[account(mut)]
    pub pair: Account<'info, TradingPair>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(seeds = [b"exchange"], bump)]
    pub exchange: Account<'info, Exchange>,
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Exchange {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
    pub total_volume: u64,
    pub total_fees_collected: u64,
    pub is_paused: bool,
}

impl Exchange {
    pub const LEN: usize = 32 + 2 + 8 + 8 + 1;
}

#[account]
pub struct TradingPair {
    pub exchange: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub pair_id: u64,
    pub base_reserve: u64,
    pub quote_reserve: u64,
    pub total_volume: u64,
    pub is_active: bool,
}

impl TradingPair {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Order {
    pub user: Pubkey,
    pub pair: Pubkey,
    pub order_type: OrderType,
    pub side: OrderSide,
    pub amount: u64,
    pub filled_amount: u64,
    pub price: u64,
    pub timestamp: i64,
    pub is_active: bool,
}

impl Order {
    pub const LEN: usize = 32 + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum OrderType {
    Limit,
    Market,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Exchange is paused")]
    ExchangePaused,
    #[msg("Trading pair is inactive")]
    PairInactive,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Unauthorized")]
    Unauthorized,
}
