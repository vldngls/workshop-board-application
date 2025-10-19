# Workshop Board Application - Deployment Guide

## Overview
This guide will help you deploy the Workshop Board Application (Monorepo) to Vercel.

## Project Structure
This is a monorepo containing:
- **`web/`** - Next.js frontend application
- **`server/`** - Express.js backend application

## Prerequisites
- A Vercel account
- Git repository with the code
- MongoDB database (for backend)

## Deployment Steps

### 1. Create Deployment Branch
```bash
git checkout -b deployment
git push -u origin deployment
```

### 2. Set Up Vercel Projects

#### Option A: Deploy Both to Vercel (Recommended)

**Frontend Project:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Select the `deployment` branch
5. Set the root directory to `web`
6. Project name: `workshop-board-frontend`

**Backend Project:**
1. Create another project in Vercel
2. Import the same Git repository
3. Select the `deployment` branch
4. Set the root directory to `server`
5. Project name: `workshop-board-backend`

#### Option B: Frontend to Vercel, Backend to Another Platform
- Deploy `web/` to Vercel as above
- Deploy `server/` to Railway, Render, or similar platform

### 3. Configure Environment Variables

#### Frontend Environment Variables (web/ project):
- `NEXT_PUBLIC_API_BASE_URL`: Your backend API URL (e.g., `https://workshop-board-backend.vercel.app`)
- `JWT_SECRET`: A strong, random string for JWT token signing
- `API_KEY`: A strong, random string for API authentication
- `NODE_ENV`: Set to `production`

#### Backend Environment Variables (server/ project):
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Same as frontend (must match)
- `API_KEY`: Same as frontend (must match)
- `NODE_ENV`: Set to `production`
- `PORT`: Set to `3000` (Vercel default)

#### Example Values:
**Frontend:**
```
NEXT_PUBLIC_API_BASE_URL=https://workshop-board-backend.vercel.app
JWT_SECRET=your-production-jwt-secret-here-make-it-long-and-random
API_KEY=your-production-api-key-here-make-it-long-and-random
NODE_ENV=production
```

**Backend:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/workshop-board
JWT_SECRET=your-production-jwt-secret-here-make-it-long-and-random
API_KEY=your-production-api-key-here-make-it-long-and-random
NODE_ENV=production
PORT=3000
```

### 4. Build Configuration
The project is already configured with:
- `web/vercel.json` for frontend deployment settings
- `server/vercel.json` for backend deployment settings
- `web/next.config.mjs` for Next.js configuration
- ESLint rules set to warnings (not errors) for deployment

### 5. Deploy Backend First
1. Deploy the backend project first to get the API URL
2. Note the deployment URL (e.g., `https://workshop-board-backend.vercel.app`)
3. Test the backend health endpoint: `https://workshop-board-backend.vercel.app/health`

### 6. Deploy Frontend
1. Update the frontend environment variable `NEXT_PUBLIC_API_BASE_URL` with your backend URL
2. Deploy the frontend project
3. Wait for the build to complete
4. Check the deployment URL

## Post-Deployment Checklist

### ✅ Verify Deployment
- [ ] Application loads without errors
- [ ] Login functionality works
- [ ] API calls are successful
- [ ] All pages are accessible
- [ ] Responsive design works on mobile

### ✅ Test Key Features
- [ ] User authentication
- [ ] Appointment management
- [ ] Job order creation and management
- [ ] Technician scheduling
- [ ] Workshop timetable

### ✅ Performance Check
- [ ] Page load times are acceptable
- [ ] No console errors
- [ ] Images and assets load correctly

## Monorepo Deployment Notes

### Important Considerations:
- **Deploy Backend First**: Always deploy the backend before the frontend to get the API URL
- **Environment Variables**: JWT_SECRET and API_KEY must match between frontend and backend
- **CORS Configuration**: Backend is configured to accept requests from the frontend domain
- **Database**: Ensure MongoDB is accessible from Vercel (use MongoDB Atlas for production)

### File Structure:
```
workshop-board-application/
├── web/                    # Next.js Frontend
│   ├── vercel.json        # Frontend Vercel config
│   ├── package.json       # Frontend dependencies
│   └── src/               # Frontend source code
├── server/                # Express.js Backend
│   ├── vercel.json        # Backend Vercel config
│   ├── package.json       # Backend dependencies
│   └── src/               # Backend source code
└── DEPLOYMENT_GUIDE.md    # This guide
```

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check that all environment variables are set in both projects
2. **API Errors**: Verify the `NEXT_PUBLIC_API_BASE_URL` points to your backend URL
3. **Authentication Issues**: Ensure `JWT_SECRET` matches between frontend and backend
4. **CORS Errors**: Check backend CORS configuration and frontend URL
5. **Database Connection**: Verify MongoDB URI is correct and accessible
6. **Monorepo Issues**: Ensure you're deploying from the correct root directory for each project

### Environment Variables Not Working:
- Ensure variables are set in Vercel's project settings
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

## Security Notes
- Use strong, random strings for `JWT_SECRET` and `API_KEY`
- Never commit production secrets to Git
- Regularly rotate secrets
- Use HTTPS for all API calls

## Monitoring
- Set up Vercel Analytics for performance monitoring
- Monitor error logs in Vercel dashboard
- Set up alerts for deployment failures

## Rollback Plan
- Keep previous deployment branch as backup
- Use Vercel's deployment history to rollback if needed
- Test rollback procedure before going live
