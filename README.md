# Telegram Capture — Vercel Deployment

**For authorized security testing only.**

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USER/telegram-capture&env=TELEGRAM_BOT_TOKEN&envDescription=Get%20a%20bot%20token%20from%20%40BotFather%20on%20Telegram)

## Manual Setup

### 1. Create a Telegram Bot
1. Open Telegram → search **@BotFather**
2. Send `/newbot` → follow prompts → **copy the bot token**

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Clone this repo
git clone https://github.com/YOUR_USER/telegram-capture.git
cd telegram-capture

# Deploy
vercel --prod
