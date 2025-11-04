# Workshop Board Application

A comprehensive MERN workshop management system with TypeScript, featuring appointment scheduling, job order tracking, technician scheduling, quality inspection workflow, and real-time status updates.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, MongoDB, Mongoose
- **Authentication**: JWT with role-based access control (RBAC)
- **UI/UX**: React Hot Toast notifications, responsive design
- **Deployment**: Vercel-ready frontend

## Key Features

- **Dashboard Overview**: Real-time statistics, carried over jobs, important jobs
- **Appointment Management**: Create, schedule, convert to job orders, no-show tracking
- **Job Order Management**: Complete lifecycle management with task tracking
- **Workshop Timetable**: Interactive visual timetable with technician scheduling
- **Quality Inspection Workflow**: Submit, approve, reject, and release jobs
- **Role-Based Access Control**: Administrator, Job Controller, Technician, Service Advisor
- **Smart Features**: Conflict detection, break time management, toast notifications

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local, Docker, or Atlas)
- Git

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
npm run init

# The script will prompt you to choose:
# 1. Local Development (localhost only)
# 2. Network Deployment (accessible from other devices)

# Start development
npm run dev
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

### Default Login Credentials (after seeding)
- **Administrator**: `admin` / `test123456`
- **Job Controller**: `jobcontroller` / `test123456`
- **Technician 1**: `technician1` / `test123456`
- **Service Advisor 1**: `serviceadvisor1` / `test123456`

## Job Status Types

| Status | Code | Description |
|--------|------|-------------|
| On Going | OG | Job currently in progress |
| Waiting Parts | WP | Waiting for parts to arrive |
| Quality Inspection | QI | Pending quality check |
| Hold Customer | HC | Waiting for customer response |
| Hold Warranty | HW | Warranty claim processing |
| Hold Insurance | HI | Insurance claim processing |
| For Release | FR | Ready for customer pickup |
| Complete | CP | Released to customer (FINAL) |

## Project Structure

```
workshop-board-application/
├── workspace/                 # Workspace utilities
│   ├── scripts/               # Setup and deployment scripts
│   ├── docs/                  # Documentation
│   └── docker/                # Docker configurations
├── server/                    # Express API
│   ├── src/
│   │   ├── controllers/       # Route controllers
│   │   ├── models/            # MongoDB models
│   │   ├── middleware/        # Auth & RBAC
│   │   └── config/            # Database config
│   └── scripts/               # Utility scripts
└── web/                       # Next.js Frontend
    ├── src/
    │   ├── app/               # Next.js App Router
    │   ├── components/        # React components
    │   ├── types/             # TypeScript types
    │   └── hooks/             # Custom React hooks
    └── public/                # Static assets
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run init` | Run setup script (interactive mode selection) |
| `npm run deploy` | Run setup script for network deployment |
| `npm run dev` | Start both frontend and backend |
| `npm run server:dev` | Start only backend |
| `npm run web:dev` | Start only frontend |
| `npm run build` | Build for production |
| `npm run seed` | Seed database with sample data |

## Deployment

For detailed deployment instructions, see [workspace/docs/DEPLOYMENT.md](./workspace/docs/DEPLOYMENT.md)

### Quick Deployment Overview
1. **Local Development**: Use automated setup scripts
2. **Network Access**: Configure for multi-device access
3. **Production**: Deploy to Vercel (frontend) and Vercel/Railway (backend)

## Documentation

- **[workspace/docs/DEPLOYMENT.md](./workspace/docs/DEPLOYMENT.md)** - Complete deployment guide
- **[workspace/docs/WORKFLOW_DOCUMENTATION.md](./workspace/docs/WORKFLOW_DOCUMENTATION.md)** - Detailed workflow and features

## Support

For issues or questions, contact the project maintainer.

---

**Built with love using the MERN stack and modern web technologies**