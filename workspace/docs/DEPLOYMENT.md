# Workshop Board Application - Deployment Guide

A comprehensive guide for deploying the Workshop Board Application across different environments.

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local, Docker, or Atlas)
- Git

### Unified Setup Script Features

The new unified setup script (`workspace/scripts/setup.ps1` / `workspace/scripts/setup.sh`) provides:

- **Interactive mode selection**: Choose between local or network deployment
- **Automatic environment file creation**: Generates correct .env files based on your choice
- **IP address detection**: Automatically detects your local IP for network mode
- **MongoDB setup**: Configures Docker MongoDB with appropriate settings
- **Database seeding**: Optional database seeding with sample data
- **Command-line options**: Skip prompts by specifying mode directly

### Automated Setup (Recommended)

```bash
# Clone repository
git clone <your-repo-url>
cd workshop-board-application

# Run unified setup script
# Windows PowerShell:
.\workspace\scripts\setup.ps1

# Unix/Linux/macOS:
chmod +x workspace/scripts/setup.sh
./workspace/scripts/setup.sh

# Or use npm scripts:
npm run init          # Non-interactive (auto defaults: development + network)
npm run init:interactive  # Guided prompts

# Override defaults on the fly:
# npm run init -- --mode local --seed enhanced --api-key YOUR_KEY
# Preconfigured dealership network setup:
# npm run deploy

# Start development
npm run dev

> The development servers bind to `0.0.0.0`, so in network mode any device on the same LAN can reach the app at `http://<your-ip>:3000`.
```

**Access Points:**

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000>

---

## Environment Configurations

### Local Development

**Server (.env):**

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
```

**Frontend (.env.local):**

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
```

### Network Access (Multi-device)

**Setup:**

```bash
# Option 1: Use unified setup script and choose network mode
# Windows PowerShell:
.\workspace\scripts\setup.ps1

# Unix/Linux/macOS:
chmod +x workspace/scripts/setup.sh
./workspace/scripts/setup.sh

# Or use npm scripts:
npm run init

# Option 2: Specify network mode directly
# Windows PowerShell:
.\workspace\scripts\setup.ps1 -Mode network

# Unix/Linux/macOS:
./workspace/scripts/setup.sh --mode network

# Or use npm scripts:
npm run init -- --mode network
```

**Server (.env):**

```env
PORT=4000
HOST=0.0.0.0
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
NODE_ENV=development
WEB_ORIGIN=http://YOUR_IP:3000
```

**Frontend (.env.local):**

```env
NEXT_PUBLIC_API_BASE_URL=http://YOUR_IP:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
```

### Production (Vercel)

**Backend Environment Variables:**

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/workshop-board
JWT_SECRET=your-production-jwt-secret
API_KEY=your-production-api-key
WEB_ORIGIN=https://your-frontend-domain.vercel.app
```

**Frontend Environment Variables:**

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.vercel.app
JWT_SECRET=your-production-jwt-secret
API_KEY=your-production-api-key
```

---

## MongoDB Setup Options

### Option A: Docker (Recommended)

```bash
# Local development
docker-compose -f docker-compose.dev.yml up -d mongodb

# Network access
docker-compose -f docker-compose.network.yml up -d mongodb

# Optional: MongoDB Express for database management
# Access at: http://localhost:8081 (admin/admin)
```

### Option B: MongoDB Atlas (Production)

1. Create cluster at [MongoDB Atlas](https://cloud.mongodb.com)
2. Get connection string
3. Update `MONGODB_URI` environment variable

### Option C: Local Installation

1. Install MongoDB locally
2. Start MongoDB service
3. Use default connection: `mongodb://localhost:27017/workshop_board`

---

## Database Seeding

```bash
# Basic seed data
npm run seed

# Enhanced seed data
npm run seed:enhanced

# Comprehensive seed data
npm run seed:comprehensive
```

**Default Login Credentials:**

- Administrator: `admin` / `test123456`
- Job Controller: `jobcontroller` / `test123456`
- Technician 1: `technician1` / `test123456`
- Service Advisor 1: `serviceadvisor1` / `test123456`

---

## Production Deployment (Vercel)

### Step 1: Deploy Backend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Set root directory to `server`
5. Configure environment variables
6. Deploy and note the URL

### Step 2: Deploy Frontend

1. Create another project in Vercel
2. Set root directory to `web`
3. Configure environment variables
4. Update `NEXT_PUBLIC_API_BASE_URL` with backend URL
5. Deploy

### Step 3: Verify Deployment

- [ ] Backend health endpoint responds: `https://your-backend.vercel.app/health`
- [ ] Frontend loads without errors
- [ ] Login functionality works
- [ ] API calls are successful

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run server:dev` | Start only backend |
| `npm run web:dev` | Start only frontend |
| `npm run build` | Build for production |
| `npm run start` | Start production build |
| `npm run seed` | Seed database |

---

## Network Access Setup

### Quick Network Setup

```bash
# Windows PowerShell:
.\workspace\scripts\setup.ps1

# Unix/Linux/macOS:
chmod +x workspace/scripts/setup.sh
./workspace/scripts/setup.sh

# Or use npm scripts:
npm run init
```

### Manual Network Configuration

1. Find your local IP address:
   - Windows: `ipconfig`
   - macOS/Linux: `ifconfig` or `ip addr show`
2. Update environment files with your IP address
3. Use `docker-compose.network.yml` for MongoDB
4. Start application with `npm run dev`

**Access URLs:**

- Local: <http://localhost:3000>
- Network: <http://YOUR_IP:3000>

### Firewall Configuration

Ensure your firewall allows connections on:

- Port 3000 (Frontend)
- Port 4000 (Backend API)
- Port 8081 (MongoDB Express - optional)

**Platform tips**
- Windows: Open *Windows Defender Firewall → Advanced Settings → Inbound Rules* and allow `node.exe` (or create rules for ports 3000/4000)
- macOS: *System Settings → Network → Firewall → Options*; allow incoming connections for the Terminal app or Node.js
- Linux: `sudo ufw allow 3000/tcp` and `sudo ufw allow 4000/tcp` (or the equivalent for your firewall tooling)

### Non-interactive setup flags

- `--auto` — skip prompts (defaults to development + network, skip seeding)
- `--env <development|dealership|production>` — force environment
- `--mode <local|network>` — choose binding strategy
- `--seed <skip|basic|enhanced|comprehensive>` — seed database automatically
- `--api-key <value>` — immediately apply an API key (pair with `--seed` as needed)
- `--skip-api-key` — skip API key configuration step entirely

Examples:

```bash
# Development laptop, local-only, enhanced seed data
npm run init -- --mode local --seed enhanced

# Dealership PC ready for LAN access (auto IP detection, random secrets)
npm run deploy

# Production prep (still generates placeholder env files you can edit)
npm run init -- --env production --mode network --auto
```

---

## Security Considerations

### Development

- Network access features only active in development
- CORS allows local network IP ranges
- Shared JWT secrets for local testing

### Production

- CORS restricted to specific production domains
- Strong, unique JWT secrets
- HTTPS for all communications
- Environment variables properly isolated

---

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

- Ensure MongoDB is running on port 27017
- Check connection string in `.env`
- For Docker: `docker-compose ps`

#### 2. Port Already in Use

- Kill processes using ports 3000 or 4000
- Check for other MongoDB instances

#### 3. CORS Errors

- Verify `WEB_ORIGIN` matches your frontend URL
- Check environment variables are set correctly
- Restart servers after changing environment variables

#### 4. Build Failures

- Ensure all environment variables are set
- Check Node.js version compatibility
- Clean install: `rm -rf node_modules && npm install`

#### 5. Network Access Issues

- Verify IP address in environment files
- Check firewall settings
- Ensure server binds to `0.0.0.0`

### Testing Network Access

```bash
# Test from another device
curl http://YOUR_IP:4000/health

# Test frontend
# Open browser to http://YOUR_IP:3000
```

---

## Deployment Checklist

### Local Development Setup

- [ ] Node.js 18+ installed
- [ ] MongoDB running
- [ ] Environment files created
- [ ] Dependencies installed
- [ ] Application starts without errors

### Network Access

- [ ] IP address configured
- [ ] Firewall allows connections
- [ ] MongoDB accessible from network
- [ ] Application accessible from other devices

### Production Deployment

- [ ] Backend deployed and accessible
- [ ] Frontend deployed with correct API URL
- [ ] Environment variables configured
- [ ] MongoDB Atlas connected
- [ ] All functionality tested

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review application logs
3. Verify environment configuration
4. Contact project maintainer

---

**Last Updated:** January 2025  
**Version:** 1.6.4  
**Status:** Production Ready