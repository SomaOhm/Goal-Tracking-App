# Frontend & FastAPI Backend Integration Guide

This guide explains how to run the frontend and FastAPI backend together as a cohesive application.

## Prerequisites

- **Node.js** and **npm** (for frontend)
- **Python 3.8+** (for FastAPI backend)
- **pip** (Python package manager)

## Setup Instructions

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment Variables

#### Frontend (.env)

The frontend already has a `.env` file configured to point to the FastAPI backend:

```dotenv
VITE_API_URL=http://localhost:8000
```

If needed, update this to match your FastAPI server URL.

#### Backend (.env)

Create a `.env` file in the `backend/` directory with your database connection:

```dotenv
DATABASE_URL=postgresql://user:password@localhost/goaltracking
```

## Running the Application

### Option 1: Run Backend & Frontend in Separate Terminals (Recommended for Development)

**Terminal 1 - Start FastAPI Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: `http://localhost:8000`

**Terminal 2 - Start Frontend Development Server:**
```bash
cd frontend
npm run dev
```

The frontend will be available at: `http://localhost:5173`

### Option 2: Using npm Scripts

**Terminal 1 - Start FastAPI Backend:**
```bash
cd frontend
npm run dev:backend
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```

## API Integration

The frontend communicates with FastAPI through the following API functions:

### Member Operations

```typescript
import { members } from '@/api/client';

// Create a member
await members.create('John Doe', mentorId);

// Get a member
await members.get(memberId);

// List all members
await members.list();

// Update a member
await members.update(memberId, { name: 'Jane Doe', mentor_id });

// Delete a member
await members.delete(memberId);
```

### Mentor Operations

```typescript
import { mentors } from '@/api/client';

// Assign a mentor to a user
await mentors.assign(userId, mentorId);

// Get all patients of a mentor
await mentors.getPatients(mentorId);

// Get all goals for a mentee
await mentors.getMenteeGoals(userId);
```

### Using React Hooks

```typescript
import { useMember, useMentor } from '@/hooks';

function MyComponent() {
  const { createMember, loading, error } = useMember();
  const { assignMentor } = useMentor();

  const handleCreateMember = async () => {
    try {
      const member = await createMember('John Doe');
      console.log('Member created:', member);
    } catch (err) {
      console.error('Error:', error);
    }
  };

  return (
    <button onClick={handleCreateMember} disabled={loading}>
      Create Member
    </button>
  );
}
```

## API Endpoints

FastAPI backend provides the following endpoints:

```
GET    /                          Health check
GET    /health                    Health status
POST   /members                   Create a member
GET    /members                   List all members
GET    /members/{member_id}       Get member details
PUT    /members/{member_id}       Update a member
DELETE /members/{member_id}       Delete a member

POST   /mentors/{user_id}/assign  Assign a mentor to a user
GET    /mentors/{mentor_id}/patients  Get mentor's patients
GET    /mentors/{user_id}/goals   Get mentee's goals
```

## Troubleshooting

### Backend not connecting

1. **Ensure FastAPI is running:** Check that the backend server is up on `http://localhost:8000`
2. **Check CORS settings:** The FastAPI app has CORS enabled for all origins by default
3. **Verify environment variable:** Ensure `VITE_API_URL=http://localhost:8000` in frontend `.env`
4. **Check network:** Make sure there are no firewall issues blocking localhost:8000

### Database connection errors

1. **Check DATABASE_URL:** Ensure it's correctly configured in `backend/.env`
2. **Run migrations:** 
   ```bash
   cd backend
   alembic upgrade head
   ```
3. **Verify database is running:** Ensure your PostgreSQL/Supabase database is accessible

### Module not found errors

Run `npm install` in the frontend and `pip install -r requirements.txt` in the backend directory.

## Project Structure

```
Goal-Tracking-App/
├── frontend/               # React/Vite frontend application
│   ├── src/app/
│   │   ├── api/          # API client (client.ts with member/mentor functions)
│   │   ├── hooks/        # React hooks (useMember, useMentor)
│   │   └── pages/        # Page components
│   └── .env              # Frontend environment (VITE_API_URL)
│
└── backend/              # Python FastAPI backend
    ├── app/
    │   ├── api/          # API routers (member.py, mentor.py)
    │   ├── services/     # Business logic
    │   └── main.py       # FastAPI app entry point
    └── requirements.txt  # Python dependencies
```

## Next Steps

1. **Frontend components:** Create React components that use the `useMember()` and `useMentor()` hooks
2. **Authentication:** Implement user authentication with the backend
3. **Database schema:** Ensure your database has the required tables for members and mentors
4. **Testing:** Test the API endpoints using tools like Postman or curl
