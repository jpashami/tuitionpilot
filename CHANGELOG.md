# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-12-19

### Added
- **Multi-Merchant Payment Platform** - Complete platform for merchant registration and payments
- SQLite database with merchants, transactions, and platform_settings tables
- Merchant registration system with AgnicPay integration
- Merchant marketplace with search and filtering
- Payment processing with automatic fee calculation (merchant fee + platform fee)
- Individual merchant dashboards with earnings and transaction history
- Platform admin dashboard for managing merchants and viewing statistics
- Enhanced AgnicPay integration with merchant monetization headers
- Basic authentication system for merchants and admin
- Fee calculation logic with breakdown display
- Transaction recording and history tracking
- Merchant card components for marketplace display

### Changed
- Updated home page to include marketplace, merchant registration, and admin links
- Enhanced payment flow to support merchant-specific payments
- Improved AgnicPay integration to support merchant fee headers (X-Merchant-Id, X-Merchant-Wallet, X-Merchant-Fee-Percent)

### Technical
- Added better-sqlite3 for database operations
- Created database schema with proper indexes
- Implemented payment processing with fee calculation
- Added merchant management APIs
- Created admin APIs for platform statistics

## [0.1.4] - 2024-12-19

### Added
- **Pay Merchant** information section explaining X402 merchant payment requirements
- New payment type option: "Pay Merchant" (informational, redirects to X402 Proxy)
- Clear explanation that AgnicPay uses X402 protocol (no direct wallet transfers)
- Guidance on using X402 Proxy for merchant payments
- Warning message explaining merchants need X402-enabled API endpoints

### Changed
- Updated merchant payment flow to explain X402 protocol requirements
- Clarified that direct wallet-to-wallet payments are not supported
- Updated QuickReference to explain X402 merchant payment process
- Improved error handling for unsupported payment methods

### Fixed
- Fixed error: "Cannot POST /api/payment" - AgnicPay doesn't support direct wallet payments
- Updated implementation to guide users to use X402 Proxy for merchant payments

## [0.1.3] - 2024-12-19

### Added
- Enhanced PaymentStatus component with detailed payment breakdown
- Payment flow explanation showing: You → AgnicPay (Gateway) → Service Provider
- Clear display of payment details:
  - Service provider (e.g., OpenAI)
  - Actual cost in USD and USDC
  - Payment status (including "skipped_pool_wallet" explanation)
  - Savings when using free credits
  - Payment verification status
- Explanation of "skipped_pool_wallet" status (free credits/pool wallet usage)
- Collapsible full API response view

### Changed
- Improved payment status messages to explain merchant relationship
- Better formatting of micro-USDC amounts

## [0.1.2] - 2024-12-19

### Added
- OnboardingGuide component with step-by-step setup instructions
- QuickReference component explaining how AgnicPay embedded wallet system works
- Clear explanation of embedded wallet vs traditional wallet (MetaMask/Solflare)
- Step-by-step workflow for:
  - Creating AgnicPay account
  - Generating API token
  - Configuring environment variables
  - Making payments
- Visual progress indicator in onboarding guide
- Updated home page to clarify no wallet connection needed

### Changed
- Client page now shows onboarding guide by default for new users
- Improved user guidance and workflow clarity

## [0.1.1] - 2024-12-19

### Changed
- Updated Next.js from 14.2.5 to 16.1.1 (latest version)
- Updated eslint-config-next to 16.1.1 to match Next.js version
- Updated ESLint from 8.57.0 to 9.0.0 for Next.js 16 compatibility
- Next.js automatically updated tsconfig.json with recommended settings

## [0.1.0] - 2024-12-19

### Added
- Initial project setup with Next.js 14, TypeScript, and Tailwind CSS
- Project structure for AgnicPay merchant and client application
- Configuration files: package.json, tsconfig.json, tailwind.config.ts
- Version tracking file (VERSION)
- Changelog file (CHANGELOG.md)
- AgnicPay API client library (lib/agnicpay.ts) with support for:
  - Balance checking
  - AI Gateway chat completions
  - X402 Fetch Proxy
- Client application (app/client/page.tsx) with:
  - UI for making payments via AI Gateway
  - UI for making payments via X402 Proxy
  - Real-time balance display
  - Payment status tracking
- Merchant dashboard (app/merchant/page.tsx) with:
  - Payment history table
  - Payment statistics
  - Balance display
  - Payment verification (simulated)
- Shared components:
  - BalanceDisplay component for showing wallet balance
  - PaymentStatus component for payment feedback
- API routes:
  - /api/client/balance - Get wallet balance
  - /api/client/chat - AI Gateway chat completions
  - /api/client/fetch - X402 Fetch Proxy
  - /api/merchant/payments - Payment history and verification
- Responsive design with Tailwind CSS
- Dark mode support
- Error handling throughout the application
- Environment variable configuration (env.example)
