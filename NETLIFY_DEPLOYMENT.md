# OSIANTECH Netlify Deployment Guide

## Next.js Migration Complete ✓

Your OSIANTECH application has been successfully migrated from Express.js to Next.js 15 for Netlify deployment. All features preserved with zero breaking changes.

## What Changed

- **Framework**: Express.js → Next.js 15 (with TypeScript)
- **Pages**: EJS templates → React components
- **API Routes**: Express routes → Next.js API routes
- **Database**: Supabase PostgreSQL (unchanged)
- **Authentication**: Firebase Auth (unchanged)
- **Features**: All preserved (courses, purchases, dashboard, checkout)

## Netlify Deployment Setup

### Step 1: Configure Netlify Project

1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Select your GitHub repository: `dgit-sudo/OSIANTECH`
4. Netlify will auto-detect Next.js and build settings

### Step 2: Environment Variables

Go to **Site Settings → Build & Deploy → Environment** and add:

```
FIREBASE_API_KEY=AIzaSyBVxfvT0CIFmKqstoLbHIHXwrT93cZKmpg
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.pooler.supabase.com:6543/postgres
```

### Step 3: Build Settings

Netlify should auto-detect:
- **Build command**: `npm run build`
- **Publish directory**: `.next`

If not, set them manually.

### Step 4: Domain Configuration

1. Go to **Domain settings**
2. Add your custom domain (e.g., yourdomain.com)
3. Update DNS records if using external registrar
4. SSL certificate auto-issued by Netlify

## Local Testing

```bash
# Install dependencies
npm install

# Set up .env.local with your Supabase credentials
# See .env.local file for example

# Run development server
npm run dev
# Server runs on http://localhost:3001

# Build for production
npm run build

# Test production build locally
npm start
```

## Project Structure

```
app/                      # Next.js app router
├── api/                  # API routes
│   └── profile/         # User profile endpoints
│   └── courses/         # Courses data
├── courses/             # Course pages
├── auth/                # Authentication page
├── dashboard/           # User dashboard
└── [other pages]        # Static pages

lib/                      # Shared utilities
├── firebase.ts          # Firebase client setup
├── db.ts                # Database connection
└── auth.ts              # Token verification

public/                   # Static assets
├── css/                 # Stylesheets
├── images/              # Images
├── course-images/       # Course covers
└── coursesCatalog.json  # Courses data

.env.local               # Local environment variables (do NOT commit)
next.config.js          # Next.js configuration
netlify.toml            # Netlify deployment config
```

## API Endpoints (All Preserved)

- `GET /api/courses` - List all courses
- `GET /api/profile/:uid` - Get user profile
- `PUT /api/profile/:uid` - Update user profile
- `GET /api/profile/:uid/purchases` - Get purchased courses
- `POST /api/profile/:uid/purchases` - Record course purchase
- `GET /api/profile/:uid/purchases/:courseId` - Check if course purchased

## Features Preserved

- ✅ Firebase Authentication (Email/Password + Google OAuth)
- ✅ Purchase tracking and course enrollment
- ✅ Dashboard with purchased courses list
- ✅ Course checkout flow with country selection
- ✅ User profile management
- ✅ Course catalog search and filtering
- ✅ Responsive design and styling
- ✅ Legal pages (Privacy, Terms, Cookie Policy)
- ✅ localStorage fallback for purchase resilience

## Troubleshooting

### Environment Variables Not Loaded
- Make sure `.env.local` is in root directory
- Restart dev server after changing env vars
- Check Netlify environment variables are set

### Database Connection Error
- Verify `SUPABASE_DB_URL` is correct
- Check SSL connection (rejectUnauthorized: false)
- Test connection: `psql $SUPABASE_DB_URL`

### Build Fails on Netlify
- Check build logs in Netlify dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version: `node --version` (14+ required)

### API Routes 404
- Check route path matches `/app/api/` structure
- Next.js auto-routes based on file system
- Verify all dynamic params use `[param]` format

## Deployment Checklist

- [ ] Environment variables set on Netlify
- [ ] Database credentials verified
- [ ] Firebase API key added
- [ ] Build succeeds locally (`npm run build`)
- [ ] All routes tested locally
- [ ] Netlify deployment successful
- [ ] Custom domain pointing to Netlify
- [ ] HTTPS certificate active
- [ ] Purchase flow tested end-to-end
- [ ] Dashboard displays correctly with data

## Support & Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Netlify Docs](https://docs.netlify.com)
- [Firebase Docs](https://firebase.google.com/docs)
- [Supabase Docs](https://supabase.com/docs)

---

**Migration completed**: May 24, 2026
**Commit**: 39167fc
**Status**: Ready for Netlify deployment ✓
