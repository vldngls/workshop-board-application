# Workshop Board Application - Deployment Guide

## Overview
This guide will help you deploy the Workshop Board Application to Vercel.

## Prerequisites
- A Vercel account
- Git repository with the code
- Backend API deployed (if using separate backend)

## Deployment Steps

### 1. Create Deployment Branch
```bash
git checkout -b deployment
git push -u origin deployment
```

### 2. Set Up Vercel Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Select the `deployment` branch
5. Set the root directory to `web`

### 3. Configure Environment Variables
In Vercel's project settings, add the following environment variables:

#### Required Variables:
- `NEXT_PUBLIC_API_BASE_URL`: Your backend API URL (e.g., `https://your-backend-api.vercel.app`)
- `JWT_SECRET`: A strong, random string for JWT token signing
- `API_KEY`: A strong, random string for API authentication
- `NODE_ENV`: Set to `production`

#### Example Values:
```
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api.vercel.app
JWT_SECRET=your-production-jwt-secret-here-make-it-long-and-random
API_KEY=your-production-api-key-here-make-it-long-and-random
NODE_ENV=production
```

### 4. Build Configuration
The project is already configured with:
- `vercel.json` for deployment settings
- `next.config.mjs` for Next.js configuration
- ESLint rules set to warnings (not errors) for deployment

### 5. Deploy
1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Check the deployment URL

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

## Troubleshooting

### Common Issues:
1. **Build Failures**: Check that all environment variables are set
2. **API Errors**: Verify the `NEXT_PUBLIC_API_BASE_URL` is correct
3. **Authentication Issues**: Ensure `JWT_SECRET` matches your backend
4. **CORS Errors**: Check backend CORS configuration

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
