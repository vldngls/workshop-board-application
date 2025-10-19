# Local Development Guide

This guide will help you set up and run the Workshop Board Application locally on your machine.

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB (local installation or Docker)
- Git

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd workshop-board-application

# Run the automated setup script
# For Unix/Linux/macOS:
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh

# For Windows PowerShell:
.\scripts\dev-setup.ps1
```

### 2. Start Development
```bash
npm run dev
```

That's it! Your application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000

## 🐳 MongoDB Setup Options

### Option A: Docker (Recommended)
```bash
# Start MongoDB with Docker Compose
docker-compose -f docker-compose.dev.yml up -d mongodb

# Optional: Start MongoDB Express for database management
docker-compose -f docker-compose.dev.yml up -d mongo-express
# Access at: http://localhost:8081 (admin/admin)
```

### Option B: Local MongoDB Installation
1. Install MongoDB locally on your system
2. Start MongoDB service
3. Default connection: `mongodb://localhost:27017/workshop_board`

## 📝 Environment Files

The setup scripts will create these files automatically:

**server/.env:**
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/workshop_board
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
```

**web/.env.local:**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=workshopjwtsecrettigerlily
API_KEY=workshopapikeytigerlily
```

## 🌱 Database Seeding

After setup, you can populate the database with sample data:

```bash
# Basic seed data
npm run seed

# Enhanced seed data
npm run seed:enhanced

# Comprehensive seed data
npm run seed:comprehensive
```

## 🔑 Default Login Credentials

After seeding, you can login with:

- **Administrator**: `admin` / `test123456`
- **Job Controller**: `jobcontroller` / `test123456`
- **Technician 1**: `technician1` / `test123456`
- **Service Advisor 1**: `serviceadvisor1` / `test123456`

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run server:dev` | Start only backend |
| `npm run web:dev` | Start only frontend |
| `npm run build` | Build for production |
| `npm run start` | Start production build |
| `npm run seed` | Seed database |

## 🔧 Troubleshooting

### MongoDB Connection Issues
- Make sure MongoDB is running on port 27017
- Check if the connection string in `.env` is correct
- For Docker: `docker-compose -f docker-compose.dev.yml ps`

### Port Already in Use
- Frontend (3000): Kill any process using port 3000
- Backend (4000): Kill any process using port 4000
- MongoDB (27017): Make sure no other MongoDB instance is running

### Dependencies Issues
```bash
# Clean install all dependencies
rm -rf node_modules server/node_modules web/node_modules
npm run install:all
```

### Environment Variables
- Make sure `.env` files are created in the correct locations
- Check that environment variables match between frontend and backend
- Restart the development servers after changing environment variables

## 📁 Project Structure

```
workshop-board-application/
├── server/                 # Express.js backend
├── web/                   # Next.js frontend
├── scripts/               # Development scripts
├── docker-compose.dev.yml # Docker setup
└── package.json          # Root package with workspace scripts
```

## 🚀 Production Deployment

This setup is designed for local development. For production deployment:

1. **Frontend**: Deploy the `web/` directory to Vercel
2. **Backend**: Deploy the `server/` directory to Railway/Render/Heroku
3. **Database**: Use MongoDB Atlas for production

See the main README.md for detailed deployment instructions.
