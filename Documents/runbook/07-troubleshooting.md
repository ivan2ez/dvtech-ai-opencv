# 07 — Troubleshooting

## Backend Issues

### Server won't start — "Unable to connect to database"

**Cause:** Database connection failed.

**Fix (SQLite/dev):**
- Ensure `backend/database.sqlite` exists. If not, run `npm run seed`.
- Check file permissions on the sqlite file.

**Fix (MySQL/prod):**
- Verify MySQL is running: `mysqladmin ping -u root`
- Check `.env` credentials match your MySQL user/database.
- Ensure the database exists: `mysql -u root -e "SHOW DATABASES;"` should list `dvtech_ai`.

---

### "ERESOLVE: peer dependency conflict" (npm install)

**Cause:** TypeScript 7 is incompatible with ts-jest's peer requirement (`typescript >=4.3 <7`).

**Fix:** Use the npm alias approach:
```bash
npm install --save-dev "@typescript/native@npm:typescript@^7.0.2" "typescript@npm:@typescript/typescript6@^6.0.2"
```

This keeps TypeScript 7 for builds while providing TS6 API for ts-jest.

---

### "JsonWebTokenError: invalid signature"

**Cause:** Token was signed with a different `JWT_SECRET` than the one currently in `.env`.

**Fix:**
- If you changed `JWT_SECRET`, all existing tokens are invalid. Users must log in again.
- Ensure `JWT_SECRET` is consistent across restarts (not randomly generated on startup).

---

### CORS errors in browser console

**Cause:** Frontend origin doesn't match `FRONTEND_URL` in backend `.env`.

**Fix:**
- Set `FRONTEND_URL=http://localhost:5173` for local development.
- For production, set it to your exact frontend domain (e.g., `https://dvtech.example.com`).
- Ensure no trailing slash.

---

### "EADDRINUSE: port already in use"

**Cause:** Another process is using port 3000 (or 5173/8000).

**Fix (Windows):**
```cmd
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

**Fix (Linux/Mac):**
```bash
lsof -i :3000
kill -9 <pid>
```

Or change the port in `.env`.

---

## Frontend Issues

### White/blank page on a route

**Cause:** The route exists in navigation but has no matching `<Route>` in `App.tsx` or the page component doesn't exist.

**Fix:**
1. Check `App.tsx` has a `<Route path="/your-path" element={<YourPage />} />`.
2. Ensure the page component file exists and is exported correctly.
3. Check browser console for import errors.

---

### "useAuth must be used within an AuthProvider"

**Cause:** A component using `useAuth()` is rendered outside the `AuthProvider`.

**Fix:**
- Ensure `<AuthProvider>` wraps the entire app in `main.tsx`.
- If testing components in isolation, wrap with `<AuthProvider>` in the test.

---

### Login succeeds but redirects back to login

**Cause:** Token is stored but profile fetch fails, so `isAuthenticated` stays false.

**Fix:**
1. Check the backend is running and `/api/auth/profile` returns 200.
2. Check browser DevTools → Network for the profile request response.
3. Verify the token in localStorage is valid (not expired).

---

## AI Service Issues

### AI recommendations return errors

**Cause:** OpenAI API key is invalid, expired, or rate-limited.

**Fix:**
1. Verify `OPENAI_API_KEY` in backend `.env` is valid.
2. Check OpenAI dashboard for usage/spending limits.
3. Check backend logs for the specific OpenAI error message.

---

### Image upload fails

**Cause:** File too large or unsupported format.

**Fix:**
- Maximum file size depends on multer config (check `productImageController.ts`).
- Supported formats: JPEG, PNG.
- Ensure `uploads/` directory exists and is writable.

---

### AI Service returns 422 Unprocessable Entity

**Cause:** Request body/form-data doesn't match the expected Pydantic schema.

**Fix:**
- Ensure the image is sent as `multipart/form-data` with field name `image`.
- Check the request matches the expected format in `ai-service/app/models/requests.py`.

---

## Database Issues

### "SequelizeDatabaseError: SQLITE_BUSY"

**Cause:** Multiple processes writing to SQLite simultaneously.

**Fix:** SQLite doesn't handle concurrent writes well. For multi-process scenarios, switch to MySQL. For dev, ensure only one backend instance runs.

---

### Seeder fails with "Cannot find module"

**Cause:** TypeScript compilation issue or missing dependency.

**Fix:**
```bash
cd backend
npm run build   # Compile first
npm run seed    # Then seed
```

Or use tsx directly (which the seed script already does).

---

## Platform / WSL Issues

### "esbuild: installed for another platform" (WSL ↔ Windows)

**Error:**
```
Error: You installed esbuild for another platform than the one you're currently using.
Specifically the "@esbuild/win32-x64" package is present but this platform
needs the "@esbuild/linux-x64" package instead.
```

**Cause:** `node_modules` was installed on Windows but you're running the project from WSL (Linux), or vice versa. Native binaries like esbuild are platform-specific.

**Fix:**
```bash
# Delete node_modules and reinstall from the correct environment
rm -rf node_modules
npm install
```

**Rules to avoid this:**
- If developing in **WSL**, always `npm install` from WSL.
- If developing in **Windows (cmd/PowerShell)**, always `npm install` from Windows.
- **Never** share `node_modules` between Windows and WSL. They are different operating systems with different native binaries.
- If your project is on a Windows path (`/mnt/c/...`) accessed from WSL, performance will be poor. Consider cloning the repo inside the WSL filesystem (`~/projects/dvtech-ai`).

---

### Slow file system performance in WSL

**Cause:** Accessing files on `/mnt/c/` (Windows filesystem) from WSL is significantly slower due to the 9P protocol bridge.

**Fix:**
- Clone your repository inside the WSL filesystem (e.g., `~/projects/dvtech-ai`) for best performance.
- Or develop entirely in Windows (cmd/PowerShell) if the repo lives on `C:\`.

---

## General Tips

1. **Always check logs first** — Backend logs errors to stdout.
2. **Browser DevTools** — Network tab shows API request/response details.
3. **Database state** — Use a SQLite viewer (DB Browser for SQLite) to inspect data directly.
4. **Reset everything** — When all else fails:
   ```bash
   cd backend
   rm database.sqlite
   npm run seed
   ```
5. **Platform consistency** — Always run `npm install` in the same environment (Windows OR WSL, not both).
