# Docker Troubleshooting Guide

## ✅ FIXED: Permission Denied Error

### What Happened:
```
Failed to create RocksDB directory: Permission denied
```

SurrealDB container couldn't write to the Docker volume on Windows due to permission issues.

### Fix Applied:

1. **Added `user: "0:0"`** - Run container as root (UID 0, GID 0)
2. **Changed `file://` → `rocksdb://`** - Use recommended storage backend
3. **Cleaned old volume** - Removed corrupted volume with `-v` flag

### Changes Made to `docker-compose.unified.yml`:

```yaml
surrealdb:
  user: "0:0"  # NEW: Run as root for Windows compatibility
  command: start --log debug --user root --pass root rocksdb:///data/aura.db
  #                                                   ^^^^^^^ Changed from file://
```

---

## 🚀 Launch Commands:

### Normal Launch:
```powershell
.\launch-aura.ps1
```

### Clean Restart (if needed):
```powershell
# Stop and remove everything (including volumes)
docker-compose -f docker-compose.unified.yml down -v

# Restart fresh
.\launch-aura.ps1
```

---

## 🐛 Common Docker Issues on Windows:

### 1. **"Permission Denied" Errors**
**Cause**: Volume permission mismatch  
**Fix**: Run container as root with `user: "0:0"`

### 2. **"Port Already in Use"**
**Cause**: Previous containers still running  
**Fix**: 
```powershell
docker-compose down
# Or force stop all
docker stop $(docker ps -aq)
```

### 3. **"Cannot Connect to Database"**
**Cause**: Database container not healthy  
**Fix**: Check logs
```powershell
docker logs aura-database
```

### 4. **"Build Failed"**
**Cause**: Outdated Docker cache  
**Fix**: Rebuild without cache
```powershell
docker-compose build --no-cache
```

---

## 📊 Useful Docker Commands:

```powershell
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View container logs
docker logs aura-database
docker logs aura-backend
docker logs aura-frontend

# View logs (follow mode)
docker logs -f aura-backend

# Access container shell
docker exec -it aura-backend bash
docker exec -it aura-database sh

# Check container stats
docker stats

# Remove all stopped containers
docker container prune

# Remove all unused volumes
docker volume prune
```

---

## 🔍 Health Checks:

### Database:
```powershell
curl http://localhost:8000/health
```

### Backend:
```powershell
curl http://localhost:8080/health
```

### Frontend:
```
http://localhost:3000
```

---

## ⚙️ Alternative: Memory Mode (Dev Only)

If you continue having volume issues, you can use memory mode:

```yaml
# In docker-compose.unified.yml
command: start --log debug --user root --pass root memory
#                                                   ^^^^^^ No persistence
```

**Warning**: All data is lost when container stops!

---

## ✅ Current Status:

- ✅ Fixed permission issue
- ✅ Using `rocksdb://` (recommended)
- ✅ Running as root for Windows compatibility
- ✅ Volume cleaned and ready

**Ready to launch!** 🚀

