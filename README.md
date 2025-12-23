# AJMUN Event Management System

Offline event entry/exit management system with Discord OAuth authentication and QR code scanning.

## Features

- **Discord OAuth Authentication**: Users log in with their Discord account
- **QR Code Issuance**: Generate signed QR codes after login
- **Reception Scanner**: Staff-only QR code scanning page
- **Attendance Management**: Check and manage attendance via Discord Bot
- **Multi-Server Support**: Supports 6 conference servers + 1 operations server

## Tech Stack

- **Frontend**: Next.js 16, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (Prisma ORM)
- **Authentication**: Discord OAuth2
- **Bot**: Discord.js

## Setup

### Requirements

- Node.js v22+
- npm

### Installation

```bash
git clone https://github.com/sudolifeagain/ajmun-x.git
cd ajmun-x
npm install
```

### Environment Variables

Create a `.env` file:

```env
# Discord OAuth2
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Discord Bot
DISCORD_BOT_TOKEN=your_bot_token

# Database
DATABASE_URL=file:./prisma/dev.db

# QR Secret
QR_SECRET=your-random-secret-32chars-or-more

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Database Initialization

```bash
npx prisma db push
```

### Running Development Server

```bash
# Web app
npm run dev

# Discord Bot (separate terminal)
npm run bot
```

Open [http://localhost:3000](http://localhost:3000) to access the app.

## Deployment

For production deployment, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Directory Structure

```
ajmun-x/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── auth/           # Discord OAuth
│   │   └── scan/           # QR Scan
│   ├── staff/              # Staff Scanner
│   ├── ticket/             # QR Code Display
│   └── lib/                # Shared Libraries
├── bot/                    # Discord Bot
│   ├── commands/           # Slash Commands
│   ├── events/             # Event Handlers
│   ├── services/           # Business Logic
│   └── utils/              # Utilities
├── prisma/                 # Prisma Schema
└── docs/                   # Documentation
```


