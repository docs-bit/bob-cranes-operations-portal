# BOB Cranes Operations Portal — Deployment Guide

## Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- MySQL 8.0+ database
- npm or pnpm package manager

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL=mysql://user:password@host:3306/database_name
JWT_SECRET=your-secure-random-secret-key

# Optional
VITE_APP_ID=your-app-id
OWNER_OPEN_ID=admin-openid-for-first-user
PORT=3000
```

## Setup Steps

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Database

```bash
# Generate migration files
npm run db:push
```

### 3. Build the Application

```bash
npm run build
```

This creates:
- `dist/public/` — Client-side assets (Vite build)
- `dist/index.js` — Server bundle (esbuild)

### 4. Start the Server

```bash
npm run start
```

The server will:
1. Start on port 3000 (or next available port)
2. Auto-create admin user on first run
3. Seed initial data (departments, crew, equipment)

## Production Deployment

### Option 1: Direct Node.js

```bash
NODE_ENV=production node dist/index.js
```

### Option 2: PM2 (Process Manager)

```bash
pm2 start dist/index.js --name bob-cranes
pm2 save
pm2 startup
```

### Option 3: Docker

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY dist/ ./dist/
COPY client/public/ ./dist/public/

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

## Database Schema

The application uses Drizzle ORM with MySQL. Key tables:

- `users` — Employee accounts with roles
- `bookings` — Crane rental bookings
- `documents` — Document uploads and tracking
- `crew` — Crew members and assignments
- `gears` — Lifting equipment and certificates
- `notifications` — System notifications
- `client_portal_tokens` — Magic link tokens for client access

## API Endpoints

### Authentication
- `POST /api/auth/login` — Email/password login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user

### Operations
- `GET /api/operations.getBookings` — List all bookings
- `GET /api/operations.getBookingById` — Get booking details
- `POST /api/operations.advanceBookingStage` — Advance booking stage
- `POST /api/operations.completeBookingWorkstream` — Complete workstream

### Documents
- `GET /api/documents.getDocuments` — List documents
- `POST /api/documents.uploadDocument` — Upload document
- `GET /api/documents.getTaxonomy` — Get document categories/tags

### Client Portal
- `POST /api/clientPortal.generateMagicLink` — Generate magic link (admin)
- `POST /api/clientPortal.verifyMagicLink` — Verify magic link (client)
- `POST /api/clientPortal.generateOtp` — Generate OTP (admin)
- `POST /api/clientPortal.verifyOtp` — Verify OTP (client)

## Client Portal Access

Clients access their portal via:
1. Admin generates magic link: `POST /api/clientPortal.generateMagicLink`
2. Client receives link: `https://your-domain.com/client/verify/{token}`
3. Client verifies link → receives JWT
4. Client accesses booking: `https://your-domain.com/client/{bookingId}`

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
PORT=3001 npm run start
```

### Database Connection Failed
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
mysql -u user -p -h host database_name
```

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install --legacy-peer-deps

# Rebuild
npm run build
```

### TypeScript Errors
```bash
# Check for type errors
npm run check

# Fix auto-fixable issues
npm run format
```

## Development Mode

```bash
# Start development server with hot reload
npm run dev
```

Note: On Windows, use `cross-env` or set `NODE_ENV=development` separately:
```bash
cross-env NODE_ENV=development tsx watch server/_core/index.ts
```

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run server/bookingRules.test.ts
```

## Performance

- Client bundle: ~376KB gzipped
- Server bundle: Node.js ESM format
- Database: Connection pooling via drizzle-orm
- Caching: In-memory caching for frequently accessed data

## Security Notes

- JWT tokens stored in sessionStorage (clears on tab close)
- Client portal uses short-lived JWT (expires after session)
- Magic links are single-use and expire after verification
- Rate limiting on client portal endpoints
- Role-based access control (RBAC) enforced at router level

## Monitoring

The application includes:
- Runtime error monitoring (`/api/runtimeMonitoring.*`)
- Web Vitals analytics (`/api/telemetry.*`)
- Audit logging for critical actions
- Activity tracking for user actions

## Backup Strategy

```bash
# Database backup
mysqldump -u user -p database_name > backup_$(date +%Y%m%d).sql

# Restore
mysql -u user -p database_name < backup_20260821.sql
```

## Scaling

For high-traffic deployments:
1. Use PM2 cluster mode: `pm2 start dist/index.js -i max`
2. Add Redis for session caching
3. Use MySQL read replicas for query distribution
4. Deploy behind a load balancer (nginx, HAProxy)

## Support

- Check `AGENTS.md` for architectural decisions
- Review `docs/superpowers/plans/` for implementation details
- See `client/public/PRD_v3.0.md` for product requirements
