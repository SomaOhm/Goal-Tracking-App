# Quick Reference: Frontend-Backend Integration

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR APPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           FRONTEND (React/TypeScript/Vite)               │   │
│  │          http://localhost:5173                           │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │           Your React Components                │    │   │
│  │  │  (Profile.tsx, Home.tsx, etc.)                 │    │   │
│  │  └────────────────┬────────────────────────────────┘    │   │
│  │                   │                                      │   │
│  │  ┌────────────────▼────────────────────────────────┐    │   │
│  │  │    React Hooks (useMember, useMentor)          │    │   │
│  │  └────────────────┬────────────────────────────────┘    │   │
│  │                   │                                      │   │
│  │  ┌────────────────▼────────────────────────────────┐    │   │
│  │  │    API Client (src/app/api/client.ts)          │    │   │
│  │  │  - members.create/list/get/update/delete       │    │   │
│  │  │  - mentors.assign/getPatients/getMenteeGoals   │    │   │
│  │  └────────────────┬────────────────────────────────┘    │   │
│  │                   │                                      │   │
│  └───────────────────┼──────────────────────────────────────┘   │
│                      │                                           │
│                      │ HTTP/JSON                                │
│                      │ VITE_API_URL=http://localhost:8000       │
│                      │                                           │
│  ┌───────────────────▼──────────────────────────────────────┐   │
│  │         BACKEND (Python/FastAPI)                         │   │
│  │        http://localhost:8000                             │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  API Routers (members.py, mentors.py)          │    │   │
│  │  │  - POST   /members                              │    │   │
│  │  │  - GET    /members, /members/{id}               │    │   │
│  │  │  - PUT    /members/{id}                         │    │   │
│  │  │  - DELETE /members/{id}                         │    │   │
│  │  │  - POST   /mentors/{user_id}/assign             │    │   │
│  │  │  - GET    /mentors/{mentor_id}/patients         │    │   │
│  │  │  - GET    /mentors/{user_id}/goals              │    │   │
│  │  └────────────────┬────────────────────────────────┘    │   │
│  │                   │                                      │   │
│  │  ┌────────────────▼────────────────────────────────┐    │   │
│  │  │    Services & Repositories                      │    │   │
│  │  │    (mentor_service.py, user_repo.py, etc.)     │    │   │
│  │  └────────────────┬────────────────────────────────┘    │   │
│  │                   │                                      │   │
│  │  ┌────────────────▼────────────────────────────────┐    │   │
│  │  │         Database (PostgreSQL/Supabase)          │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 One-Minute Setup

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

## 📝 How to Add Member/Mentor Functionality to Any Component

### Step 1: Import the hooks
```tsx
import { useMember, useMentor } from '@/hooks';
```

### Step 2: Use in your component
```tsx
function YourComponent() {
  const { createMember, listMembers, loading, error } = useMember();
  const { assignMentor } = useMentor();
  
  // Your logic here...
}
```

### Step 3: Call the functions
```tsx
// Create a member
const newMember = await createMember('John Doe');

// List members
const members = await listMembers();

// Assign a mentor
const mentor = await assignMentor(userId, mentorId);
```

That's it! You're connected to the backend.

## 🔄 Data Flow Examples

### Creating a Member (User Action → Backend → Frontend)

```
User clicks "Create Member" button
        ↓
handleCreateMember() function called
        ↓
useMember().createMember('John Doe') called
        ↓
API call: POST http://localhost:8000/members
        ↓
FastAPI /members endpoint receives request
        ↓
Database: INSERT INTO users (name) VALUES ('John Doe')
        ↓
Response returns new Member object
        ↓
Frontend receives Member { id, name, mentor_id, created_at }
        ↓
Component updates state with new member
        ↓
UI re-renders to show new member
```

### Assigning a Mentor

```
User selects member & mentor
        ↓
handleAssignMentor(memberId, mentorId)
        ↓
useMentor().assignMentor(userId, mentorId)
        ↓
API call: POST /mentors/{user_id}/assign { mentor_id }
        ↓
FastAPI calls assign_mentor() service
        ↓
Database: UPDATE users SET mentor_id = ? WHERE id = ?
        ↓
Response returns updated Member with mentor_id
        ↓
Frontend updates component state
        ↓
UI shows "Mentor assigned!" confirmation
```

## 📋 File Structure - What Was Created

```
frontend/
├── .env                                ← NEW: FastAPI URL
├── .env.example                        ← UPDATED: Documentation
├── package.json                        ← UPDATED: Added npm run dev:backend
├── src/app/
│   ├── api/
│   │   └── client.ts                  ← UPDATED: Added member & mentor APIs
│   ├── hooks/                          ← NEW
│   │   ├── index.ts                   ← NEW: Hook exports
│   │   ├── useMember.ts               ← NEW: Member operations
│   │   └── useMentor.ts               ← NEW: Mentor operations
│   └── components/
│       └── MemberMentorExample.tsx    ← NEW: Full working example
│
Root/
├── INTEGRATION_GUIDE.md                ← NEW: Setup instructions
├── IMPLEMENTATION_GUIDE.md             ← NEW: Code examples
└── INTEGRATION_SUMMARY.md              ← NEW: Overview
```

## 🧪 Testing Your Integration

### Quick Test 1: Check Backend Connection
```bash
curl http://localhost:8000/
# Should return: {"status":"healthy","version":"1.0.0","service":"Goal Tracking App"}
```

### Quick Test 2: Create a Member
```bash
curl -X POST http://localhost:8000/members \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","mentor_id":null}'
```

### Quick Test 3: From Frontend
Use the MemberMentorExample component:
1. Open http://localhost:5173
2. Import MemberMentorExample into your app
3. Click "Add Member" button
4. Watch it work!

## 💻 IDE Tips

### In VS Code:
- Press Ctrl+Shift+P → "Go to File" → `client.ts` to explore API
- Press Ctrl+Shift+P → "Go to File" → `useMember.ts` to see hooks
- Use IntelliSense (Ctrl+Space) to explore available functions

### Useful shortcuts:
- F12 → Open DevTools (Network tab shows API calls)
- Ctrl+Shift+K → Delete line (for cleanup)
- Alt+Up/Down → Move line up/down

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `VITE_API_URL is undefined` | Check `.env` file exists with correct URL |
| `Failed to fetch: 404` | Ensure FastAPI is running on port 8000 |
| `CORS error` | FastAPI has CORS enabled, should work automatically |
| `Member ID not a UUID` | Ensure you're passing valid UUID strings |
| Hook returns `undefined` | Check component is wrapped in proper context/provider |

## 🚀 Performance Tips

```typescript
// ✓ GOOD: Only load when needed
useEffect(() => {
  loadMembers();
}, []);  // Only once on mount

// ✗ AVOID: Calling in render
function BadComponent() {
  const members = listMembers();  // Called every render!
}

// ✓ GOOD: Use useCallback for handlers
const handleCreate = useCallback(async (name) => {
  await createMember(name);
}, []);

// ✓ GOOD: Show loading state
<Button disabled={loading}>
  {loading ? 'Creating...' : 'Create'}
</Button>
```

## 📚 Learn More

For deeper understanding:
- Read `INTEGRATION_GUIDE.md` for setup details
- Read `IMPLEMENTATION_GUIDE.md` for code patterns
- Check `MemberMentorExample.tsx` for working code
- Review `backend/app/api/member.py` for endpoint definitions

## ✅ Integration Checklist

- [ ] Backend `.env` configured with DATABASE_URL
- [ ] `pip install -r requirements.txt` run in backend/
- [ ] `npm install` run in frontend/
- [ ] FastAPI running: `python -m uvicorn app.main:app --reload`
- [ ] Frontend running: `npm run dev`
- [ ] Frontend can reach backend: http://localhost:8000 returns status
- [ ] Imported hooks in a component: `import { useMember } from '@/hooks'`
- [ ] Called at least one API function (e.g., listMembers())
- [ ] Saw data returned from backend in browser console
- [ ] Integrated member/mentor functionality into your pages

Once all checked, you're fully integrated! 🎉

## 🆘 Need Help?

1. **Check the logs:**
   - Frontend: Browser console (F12)
   - Backend: Terminal where uvicorn is running

2. **Review examples:**
   - MemberMentorExample.tsx - Full working component
   - IMPLEMENTATION_GUIDE.md - Code patterns

3. **Test API directly:**
   - Use Postman or curl to test endpoints
   - Verify FastAPI responds correctly

4. **Enable debug logging:**
   - Add `console.log()` in hooks to trace execution
   - Use Network tab in DevTools to inspect API calls

## 🎓 Key Concepts

**Hooks:** React functions that manage state and side effects
**API Client:** Layer that handles HTTP requests to backend
**Error States:** Hooks return `error` property for failed requests
**Loading States:** Hooks return `loading` property while request is pending

All three work together to create a smooth user experience!

---

**You're all set!** Start using member and mentor functions in your components. 🚀
