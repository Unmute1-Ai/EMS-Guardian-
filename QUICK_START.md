# 🚀 Quick Start Guide - EMS Guardian Production Deployment

This guide will get EMS Guardian up and running in production within 30 minutes.

## Prerequisites (5 minutes)

- [x] Node.js 18.0.0+ installed
- [x] Docker & Docker Compose (optional, for containerized deployment)
- [x] Git installed
- [x] OpenSSL available

## Step 1: Generate Security Keys (2 minutes)

```bash
# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"

# Generate token secret
TOKEN_SECRET=$(openssl rand -base64 32)
echo "TOKEN_SECRET=$TOKEN_SECRET"

# Save these values - you'll need them in next step
```

## Step 2: Configure Environment (3 minutes)

```bash
# Copy example environment file
cp env.example.production .env.production

# Edit configuration
nano .env.production

# Fill in these CRITICAL values:
# ENCRYPTION_KEY=<your-generated-key>
# TOKEN_SECRET=<your-generated-key>
# GEMINI_API_KEY=<your-gemini-api-key>
# API_URL=https://ems-guardian.medical (or your domain)
```

## Step 3: Install Dependencies (5 minutes)

```bash
# Install production dependencies
npm install

# Type checking
npm run type-check

# Security audit
npm run security-audit
```

## Step 4: Build for Production (5 minutes)

```bash
# Build the application
npm run build

# Verify build
ls -la dist/
```

## Step 5: Deploy (Choose One)

### Option A: Docker Compose (RECOMMENDED) - 5 minutes

```bash
# Start all services (app + nginx + logging)
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f ems-guardian

# Stop services
docker-compose -f docker-compose.production.yml down
```

### Option B: Manual Node.js - 2 minutes

```bash
# Set environment
export NODE_ENV=production
export HIPAA_MODE=true

# Start application
node --max-old-space-size=512 dist/main.js
```

### Option C: PM2 (Process Manager) - 3 minutes

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/main.js --name "ems-guardian" --instances max --env production

# View logs
pm2 logs ems-guardian

# Monitor
pm2 monit
```

## Step 6: Verify Deployment (2 minutes)

```bash
# Check application is running
curl http://localhost:3000/health

# Check logs for errors
docker logs ems-guardian (Docker) or pm2 logs (PM2)

# Verify HIPAA mode is enabled
curl http://localhost:3000/api/status
```

## Step 7: Configure HTTPS (5 minutes)

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --standalone -d ems-guardian.medical

# Configure nginx to use certificate
# Update nginx.conf:
# ssl_certificate /etc/letsencrypt/live/ems-guardian.medical/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/ems-guardian.medical/privkey.pem;

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx-proxy
```

### Using Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Copy to certs directory
mkdir -p certs/
cp cert.pem key.pem certs/
```

## Step 8: Initial User Setup (3 minutes)

```bash
# Create database
# (If using database backend)
npm run migrate:up

# Create initial admin user
npm run create-admin-user
# Follow prompts to set:
# - Email
# - Password (must meet complexity requirements)
# - MFA secret (scan with authenticator app)
# - Department
```

## Step 9: Verify Production Setup (5 minutes)

### Checklist
- [ ] Application is running and healthy
- [ ] HTTPS is working
- [ ] Database is connected and encrypted
- [ ] Audit logging is enabled
- [ ] MFA is required and working
- [ ] Backups are scheduled
- [ ] Monitoring is active
- [ ] All environment variables are set

### Test Commands

```bash
# Health check
curl https://ems-guardian.medical/health

# Test authentication
curl -X POST https://ems-guardian.medical/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPassword123!"}'

# Check system status
curl https://ems-guardian.medical/api/system/status

# View audit logs
curl https://ems-guardian.medical/api/audit/logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 10: Enable Backups (2 minutes)

```bash
# Daily backups (configure in cron)
0 2 * * * /home/ems-guardian/backup.sh

# Weekly backups
0 3 * * 0 /home/ems-guardian/backup-weekly.sh

# Monthly backups
0 4 1 * * /home/ems-guardian/backup-monthly.sh
```

---

## Monitoring & Maintenance

### Daily
```bash
# Check application status
docker-compose -f docker-compose.production.yml ps

# Check logs for errors
docker-compose -f docker-compose.production.yml logs --tail=50 ems-guardian

# Verify database is running
docker-compose -f docker-compose.production.yml logs elasticsearch
```

### Weekly
```bash
# Review backup logs
ls -la /backups/daily/

# Check disk usage
df -h

# Monitor performance
docker stats
```

### Monthly
```bash
# Rotate logs
logrotate /etc/logrotate.d/ems-guardian

# Review security logs
grep "CRITICAL" logs/audit.log

# Update dependencies
npm audit
npm update --production
```

---

## Troubleshooting

### Application Won't Start
```bash
# Check environment variables
env | grep -i ems

# Check logs
docker logs ems-guardian

# Verify encryption key is set
echo $ENCRYPTION_KEY

# Restart container
docker-compose -f docker-compose.production.yml restart ems-guardian
```

### HTTPS Not Working
```bash
# Verify certificate files exist
ls -la certs/

# Check nginx configuration
docker exec ems-guardian-nginx nginx -t

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx-proxy
```

### Database Connection Issues
```bash
# Check database logs
docker logs ems-guardian-elasticsearch

# Test connection
curl localhost:9200

# Restart database
docker-compose -f docker-compose.production.yml restart log-collector
```

### Performance Issues
```bash
# Check system resources
docker stats

# View slow queries
docker logs ems-guardian | grep "slow"

# Scale horizontally (add more replicas)
docker-compose -f docker-compose.production.yml up -d --scale ems-guardian=3
```

---

## Security Reminders

⚠️ **CRITICAL SECURITY REQUIREMENTS**

1. **Never commit .env.production to Git**
   ```bash
   # Add to .gitignore
   .env.production
   .env.*.local
   certs/
   ```

2. **Rotate encryption keys every 90 days**
   ```bash
   # Generate new key
   openssl rand -base64 32
   
   # Update .env.production
   # Restart application
   ```

3. **Enable automatic backups**
   ```bash
   # Verify daily backups are running
   ls -la /backups/daily/ | tail -1
   ```

4. **Monitor audit logs for anomalies**
   ```bash
   # Check for suspicious activity
   grep "FAILURE" logs/audit.log
   ```

5. **Keep dependencies updated**
   ```bash
   npm audit
   npm update --save
   npm run build
   ```

---

## Next Steps

1. ✅ Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed information
2. ✅ Review [SECURITY_POLICY.md](./SECURITY_POLICY.md) for compliance requirements
3. ✅ Complete [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) before going live
4. ✅ Conduct security penetration testing
5. ✅ Get Medical Director and Compliance Officer approval
6. ✅ Train all staff on system usage
7. ✅ Plan launch day with all stakeholders
8. ✅ Enable comprehensive monitoring and alerting

---

## Support

- **Deployment Issues**: Check logs and restart services
- **Security Concerns**: Contact security@ems-guardian.medical
- **Clinical Questions**: Consult Medical Director
- **Compliance**: Contact compliance@ems-guardian.medical

---

**EMS Guardian Production Deployment**
*Version 1.0.0 - Ready in 30 minutes*
