# Serverless Auction Platform

A fully serverless, real-time auction platform built with AWS CDK (TypeScript), featuring user authentication, auction management, automated bidding, scheduled auction closing, email notifications, and comprehensive audit trails.

## 🏗️ Architecture Overview

This platform leverages a modern serverless architecture with the following AWS services orchestrated through AWS CDK:

### Core Services

- **Amazon API Gateway**: REST API with 15 endpoints across 3 resource groups (`/health`, `/auctions`, `/auth`)
- **AWS Lambda**: 18 Node.js 22.x functions handling business logic
- **Amazon DynamoDB**: 2 tables with GSIs and TTL for data persistence
- **Amazon EventBridge**: 2 rules for scheduled processing and event-driven workflows
- **Amazon SQS**: Reliable message queuing with DLQ for notification delivery
- **Amazon SES**: Email notifications for auction winners
- **Amazon S3**: Encrypted, versioned bucket for audit trail storage
- **Amazon CloudWatch**: Centralized logging and custom metrics

### Architecture Diagram

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     ▼
┌──────────────────┐
│  API Gateway     │  JWT Cookie Authentication
│  (REST API)      │  (accessToken + refreshToken)
└────┬─────────────┘
     │
     ├──► /health ──────────────────────► health-check Lambda
     │
     ├──► /auctions ────────────────────► Auction Lambdas (10 functions)
     │    ├─ POST /                      create-auction
     │    ├─ GET /                       get-all-auctions
     │    ├─ GET /{id}                   get-auction-by-id
     │    ├─ PUT /{id}                   update-auction
     │    ├─ DELETE /{id}                delete-auction
     │    ├─ POST /{id}/bid              place-bid
     │    ├─ POST /{id}/close            auction-close (manual)
     │    └─ GET /{id}/result            auction-result
     │
     └──► /auth ───────────────────────► Auth Lambdas (6 functions)
          ├─ POST /signup                signup
          ├─ POST /resend-code           resend-code
          ├─ POST /verify-user           verify-user
          ├─ POST /signin                signin
          ├─ POST /refresh               refresh
          └─ POST /signout               logout
                │
                ▼
     ┌──────────────────────┐
     │  DynamoDB Tables     │
     ├──────────────────────┤
     │ • Auctions           │  PK/SK, GSI1 (status+endsAt), TTL
     │ • Authentication     │  PK/SK, EmailIndex GSI, TTL
     └──────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Event-Driven Workflows                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  EventBridge (Scheduled)                                   │
│  ├─ Rate(100 min) ──► process-auctions Lambda             │
│  │                    ├─ Close expired auctions            │
│  │                    ├─ Send SQS message (winner info)    │
│  │                    └─ Emit 'AuctionClosed' event        │
│  │                                                          │
│  EventBridge (Event Pattern)                               │
│  └─ 'AuctionClosed' ──► generate-auction-audit Lambda      │
│                         └─ Write audit JSON to S3          │
│                                                            │
│  SQS Queue: AuctionClosedQueue + DLQ                       │
│  └─ Triggers ──► auction-notify Lambda ──► SES SendEmail  │
└────────────────────────────────────────────────────────────┘
```

## 🚀 Features

### Authentication & Authorization

- **User Registration**: Email-based signup with OTP verification
- **Email Verification**: 6-digit OTP with 10-minute expiry
- **JWT Authentication**: Secure cookie-based tokens (access: 15min, refresh: 7 days)
- **Role-Based Access**: USER and ADMIN roles with granular permissions
- **Token Refresh**: Automatic token renewal without re-login

### Auction Management

- **Create Auctions**: Admin-only with configurable duration (up to 7 days)
- **List Auctions**: Get all open auctions sorted by ending time
- **Auction Details**: Retrieve individual auction information
- **Update Auctions**: Modify auction details (only if no bids placed)
- **Delete Auctions**: Remove auctions without bids
- **Automated Closing**: Scheduled EventBridge rule closes expired auctions every 100 minutes
- **Manual Closing**: Admin can close auctions before expiry

### Bidding System

- **Place Bids**: Atomic transaction ensuring bid amount > current highest bid
- **Bid Validation**: Prevents bids on closed or expired auctions
- **Bid History**: All bids stored with timestamps for audit trail
- **Optimistic Locking**: DynamoDB conditional writes prevent race conditions

### Notifications

- **Winner Emails**: Automated SES emails to auction winners
- **Queue-Based Delivery**: SQS ensures reliable message delivery
- **DLQ Support**: Failed notifications routed to dead-letter queue

### Audit & Compliance

- **Automated Audits**: EventBridge triggers audit generation on auction close
- **Complete History**: Audit includes all bids, winner, timestamps
- **S3 Storage**: Encrypted, versioned JSON files with deterministic keys
- **TTL Management**: Automatic data cleanup via DynamoDB TTL

### Observability

- **Structured Logging**: JSON logs with request IDs and context
- **Custom Metrics**: CloudWatch metrics for health checks and auction processing
- **Error Tracking**: Comprehensive error logging with stack traces

## 📊 Data Models

### DynamoDB: Auctions Table

**Primary Keys:**

- `PK`: `AUCTION#{auctionId}`
- `SK`: `AUCTION` (auction item) or `BID#{timestamp}#{bidId}` (bid items)

**GSI1 (Status by End Time):**

- `GSI1PK`: `STATUS#OPEN` or `STATUS#CLOSED`
- `GSI1SK`: `endsAt` (Unix timestamp)

**Attributes:**

```typescript
{
  auctionId: string,
  title: string,
  description: string,
  startingPrice: number,
  highestBidAmount: number,
  highestBidderId: string | null,
  status: 'OPEN' | 'CLOSED',
  endsAt: number,           // Unix timestamp
  recordExpiresAt: number,  // TTL (endsAt + 10 days)
  createdAt: number,
  updatedAt: number
}
```

### DynamoDB: Authentication Table

**Primary Keys:**

- `PK`: `USER#{userId}`
- `SK`: `PROFILE`

**GSI (Email Index):**

- `GSI1PK`: `EMAIL#{email}`
- `GSI1SK`: `PROFILE`

**Attributes:**

```typescript
{
  name: string,
  email: string,
  password: string,         // bcrypt hashed
  role: 'USER' | 'ADMIN',
  emailVerified: boolean,
  verificationCode?: string,
  verificationCodeExpiresAt?: string,      // ISO timestamp
  accountVerificationExpiresAt?: number,   // TTL (48 hours)
  createdAt: string,
  updatedAt: string
}
```

## 🔌 API Endpoints

### Health Check

- `GET /health` - Service health status

### Auctions (Authenticated)

- `POST /auctions` - Create auction (Admin only)
- `GET /auctions` - List all open auctions
- `GET /auctions/{auctionId}` - Get auction details
- `PUT /auctions/{auctionId}` - Update auction (Admin only, no bids)
- `DELETE /auctions/{auctionId}` - Delete auction (Admin only, no bids)
- `POST /auctions/{auctionId}/bid` - Place bid
- `POST /auctions/{auctionId}/close` - Manually close auction (Admin only)
- `GET /auctions/{auctionId}/result` - Get auction result (after closing)

### Authentication

- `POST /auth/signup` - Register new user (sends OTP)
- `POST /auth/resend-code` - Resend verification OTP
- `POST /auth/verify-user` - Verify email with OTP
- `POST /auth/signin` - Login (returns JWT cookies)
- `POST /auth/refresh` - Refresh access token
- `POST /auth/signout` - Logout (clears cookies)

## 🛠️ Technology Stack

- **IaC**: AWS CDK 2.232+ (TypeScript)
- **Runtime**: Node.js 22.x
- **Language**: TypeScript 5.9+
- **Authentication**: JWT (jsonwebtoken), bcrypt
- **AWS SDK**: v3 (modular)
  - `@aws-sdk/client-dynamodb`
  - `@aws-sdk/lib-dynamodb`
  - `@aws-sdk/client-eventbridge`
  - `@aws-sdk/client-s3`
  - `@aws-sdk/client-sqs`
  - `@aws-sdk/client-ses`
  - `@aws-sdk/client-cloudwatch`
- **Testing**: Jest 30+
- **Build**: esbuild (via aws-lambda-nodejs)

## 📦 Project Structure

```
├── auctions-lambdas/
│   ├── _shared/              # Shared utilities (logger, metrics, errors)
│   ├── health-check/
│   ├── create-auction/
│   ├── get-all-auctions/
│   ├── get-auction-by-id/
│   ├── update-auction/
│   ├── delete-auction/
│   ├── place-bid/
│   ├── auction-close/
│   ├── auction-result/
│   ├── process-auctions/     # Scheduled background job
│   └── generate-auction-audit/
├── auth-lambdas/
│   ├── signup/
│   ├── resend-code/
│   ├── verify-user/
│   ├── signin/
│   ├── refresh/
│   └── logout/
├── notifications-lambdas/
│   └── auction-notify/       # SQS → SES email sender
├── lib/
│   ├── stacks/
│   │   └── serverless-auction-platform-stack.ts
│   ├── service-constructs/
│   │   ├── auction-lambda-construct.ts
│   │   ├── auth-lambda-construct.ts
│   │   ├── dynamodb-construct.ts
│   │   ├── event-bridge-construct.ts
│   │   ├── notification-ses-construct.ts
│   │   ├── notification-sqs-construct.ts
│   │   └── s3-bucket-construct.ts
│   └── functions-construct/
│       ├── auction-closed-rule-construct.ts
│       └── generate-audit-function-construct.ts
├── utils/
│   ├── auth-middleware.ts    # JWT validation & role checks
│   ├── auth-utils-functions.ts
│   ├── jwt-utils-functions.ts
│   └── constant.ts
└── bin/
    └── serverless-auction-platform.ts
```

## 🚦 Event Flows

### 1. User Registration & Login

```
Client → POST /auth/signup → signup Lambda → DynamoDB (Authentication)
  ↓
OTP generated (6-digit), stored with 10-min expiry
  ↓
Client → POST /auth/verify-user → verify-user Lambda → DynamoDB
  ↓
Email marked as verified
  ↓
Client → POST /auth/signin → signin Lambda → DynamoDB (credential check)
  ↓
JWT tokens generated → Set-Cookie headers (accessToken, refreshToken)
```

### 2. Create Auction & Place Bid

```
Client → POST /auctions → create-auction Lambda (Admin check via JWT)
  ↓
DynamoDB: Insert auction with status=OPEN, GSI1PK=STATUS#OPEN
  ↓
Client → POST /auctions/{id}/bid → place-bid Lambda
  ↓
DynamoDB: Atomic transaction
  ├─ Update auction (highestBidAmount, highestBidderId)
  └─ Insert bid record (SK=BID#{timestamp}#{bidId})
```

### 3. Automated Auction Closing

```
EventBridge Schedule (rate: 100 min) → process-auctions Lambda
  ↓
Query DynamoDB GSI1: STATUS#OPEN where GSI1SK <= now
  ↓
For each expired auction:
  ├─ Update status=CLOSED, GSI1PK=STATUS#CLOSED
  ├─ Fetch winner data from Authentication table
  ├─ Send SQS message (auctionId, finalPrice, winnerEmail, winnerName)
  └─ Emit EventBridge event (source: auction.lifecycle, detailType: AuctionClosed)
```

### 4. Notification Delivery

```
SQS: AuctionClosedQueue → auction-notify Lambda (batchSize: 1)
  ↓
SES: SendEmail to winner
  ↓
(If failure: message → AuctionClosedDLQ after 5 retries)
```

### 5. Audit Trail Generation

```
EventBridge Rule (AuctionClosed event) → generate-auction-audit Lambda
  ↓
Read auction + all bids from DynamoDB
  ↓
Build audit JSON (auction details, bid history, winner)
  ↓
S3: PutObject → audits/{title}#{auctionId}/closedAt={timestamp}.json
```

## ⚙️ Setup & Deployment

### Prerequisites

- Node.js 22.x
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`

### Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=dev
JWT_ACCESS_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
SENDER_EMAIL=verified-ses-email@example.com
```

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Deploy

```bash
# Synthesize CloudFormation template
npx cdk synth

# Deploy to AWS
npx cdk deploy

# Deploy with approval bypass (use carefully)
npx cdk deploy --require-approval never
```

### Verify SES Email

Before deployment, verify the sender email in Amazon SES:

```bash
aws ses verify-email-identity --email-address your-email@example.com
```

### Destroy Stack

```bash
npx cdk destroy
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Watch mode
npm run watch
```

## 🔐 Security Features

- **Encryption at Rest**: DynamoDB tables, S3 bucket (AES-256)
- **Encryption in Transit**: HTTPS for API Gateway, TLS for AWS service calls
- **Least Privilege IAM**: Each Lambda has minimal required permissions
- **JWT Security**: HTTP-only cookies, SameSite=Lax, Secure flag in production
- **Password Security**: bcrypt hashing with salt rounds
- **Input Validation**: Request body validation before processing
- **Conditional Writes**: Prevents race conditions in bidding
- **TTL Cleanup**: Automatic data deletion (auctions: 10 days, unverified users: 48 hours)

## 📈 Observability

### CloudWatch Logs

All Lambda functions emit structured JSON logs:

```json
{
  "level": "INFO|WARN|ERROR",
  "message": "...",
  "timestamp": "2026-01-31T...",
  "requestId": "...",
  ...context
}
```

### Custom Metrics

Namespace: `AuctionPlatform`

- `HealthCheckHit`: Health endpoint invocations
- `ProcessAuctionHit`: Auction processing runs

## 🔄 Data Lifecycle

- **Active Auctions**: Stored in DynamoDB with `status=OPEN`
- **Expired Check**: EventBridge schedule every 100 minutes
- **Closed Auctions**: Status updated to `CLOSED`, moved to different GSI partition
- **Bid History**: Retained for 10 days (TTL)
- **Unverified Users**: Deleted after 48 hours (TTL)
- **Audit Files**: Retained indefinitely in S3 (versioned)

## 🛡️ Error Handling

- **API Errors**: HTTP status codes (400, 401, 403, 404, 409, 500)
- **DynamoDB Conditional Failures**: Graceful degradation (e.g., bid rejected)
- **SQS DLQ**: Failed notification messages preserved for investigation
- **Lambda Retries**: Automatic (2 retries for EventBridge triggers)
- **Structured Errors**: Custom error classes (`HttpError`, `ForbiddenError`)

## 📝 Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm test` - Run Jest unit tests
- `npx cdk deploy` - Deploy stack to AWS
- `npx cdk diff` - Compare deployed vs current state
- `npx cdk synth` - Emit CloudFormation template
- `npx cdk destroy` - Delete all stack resources

## 🤝 Contributing

This is a personal/learning project. For production use:

1. Add comprehensive unit/integration tests
2. Implement API rate limiting
3. Add input sanitization (XSS, SQL injection prevention)
4. Enable AWS X-Ray tracing
5. Set up CI/CD pipeline
6. Add monitoring dashboards and alarms
7. Implement proper OTP email delivery (currently only generates OTP)
8. Add WebSocket support for real-time bid updates

## 📄 License

MIT
