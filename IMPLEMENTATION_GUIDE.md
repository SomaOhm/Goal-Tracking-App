# Member & Mentor Integration Implementation Guide

This guide explains how to integrate member and mentor functionality from the FastAPI backend into your React frontend components.

## Quick Start

### 1. Import the Hooks

```typescript
import { useMember, useMentor } from '@/hooks';
```

### 2. Use in Your Component

```tsx
function MyComponent() {
  const { createMember, listMembers, loading, error } = useMember();
  const { assignMentor, getMentorPatients } = useMentor();

  // Your component logic here
}
```

## Available Hooks & APIs

### Member Hook (`useMember`)

The `useMember()` hook provides member management functionality:

```typescript
const {
  loading,                    // boolean - indicates if operation is in progress
  error,                      // string | null - error message if operation failed
  createMember,              // (name, mentorId?) => Promise<Member>
  getMember,                 // (memberId) => Promise<Member>
  listMembers,               // () => Promise<Member[]>
  updateMember,              // (memberId, updates) => Promise<Member>
  deleteMember,              // (memberId) => Promise<void>
} = useMember();
```

**Examples:**

```typescript
// Create a member
try {
  const member = await createMember('John Doe', 'mentor-uuid-here');
  console.log('Created:', member);
} catch (err) {
  console.error('Failed to create:', error);
}

// List all members
try {
  const members = await listMembers();
  setMembersList(members);
} catch (err) {
  console.error('Failed to load members:', error);
}

// Update a member
try {
  const updated = await updateMember(memberId, {
    name: 'Jane Doe',
    mentor_id: newMentorId
  });
} catch (err) {
  console.error('Failed to update:', error);
}

// Delete a member
try {
  await deleteMember(memberId);
  console.log('Member deleted');
} catch (err) {
  console.error('Failed to delete:', error);
}
```

### Mentor Hook (`useMentor`)

The `useMentor()` hook provides mentor management functionality:

```typescript
const {
  loading,                   // boolean - indicates if operation is in progress
  error,                     // string | null - error message if operation failed
  assignMentor,             // (userId, mentorId) => Promise<MentorInfo>
  getMentorPatients,        // (mentorId) => Promise<Patient[]>
  getMenteeGoals,           // (userId) => Promise<MenteeGoal[]>
} = useMentor();
```

**Examples:**

```typescript
// Assign a mentor to a user
try {
  const mentor = await assignMentor(userId, mentorId);
  console.log('Mentor assigned:', mentor.name);
} catch (err) {
  console.error('Failed to assign mentor:', error);
}

// Get all patients of a mentor
try {
  const patients = await getMentorPatients(mentorId);
  setPatientsList(patients);
} catch (err) {
  console.error('Failed to load patients:', error);
}

// Get goals for a mentee
try {
  const goals = await getMenteeGoals(userId);
  setGoalsList(goals);
} catch (err) {
  console.error('Failed to load goals:', error);
}
```

## Type Definitions

The following types are available from `@/api/client`:

```typescript
interface Member {
  id: string;
  name: string;
  mentor_id: string | null;
  created_at: string;
}

interface MentorInfo {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
  mentor_id: string;
}

interface MenteeGoal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  frequency: string;
  created_at: string;
}
```

## Integration Examples

### Example 1: Member List Component

```tsx
import React, { useEffect, useState } from 'react';
import { useMember } from '@/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function MemberList() {
  const { listMembers, loading, error } = useMember();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await listMembers();
        setMembers(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadMembers();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {members.map(member => (
        <Card key={member.id} className="p-4 mb-2">
          <h3>{member.name}</h3>
          <p>Mentor: {member.mentor_id || 'Not assigned'}</p>
        </Card>
      ))}
    </div>
  );
}
```

### Example 2: Mentor Assignment Component

```tsx
import React, { useState } from 'react';
import { useMentor } from '@/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AssignMentorForm({ userId }) {
  const { assignMentor, loading, error } = useMentor();
  const [mentorId, setMentorId] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await assignMentor(userId, mentorId);
      setSuccess(true);
      setMentorId('');
      // Optionally notify the user
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-500">Mentor assigned successfully!</div>}
      
      <Input
        placeholder="Enter mentor UUID"
        value={mentorId}
        onChange={(e) => setMentorId(e.target.value)}
      />
      
      <Button type="submit" disabled={loading || !mentorId}>
        Assign Mentor
      </Button>
    </form>
  );
}
```

### Example 3: Mentee Goals Component

```tsx
import React, { useEffect, useState } from 'react';
import { useMentor } from '@/hooks';
import { Card } from '@/components/ui/card';

export function MenteeGoalsDisplay({ userId }) {
  const { getMenteeGoals, loading, error } = useMentor();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    async function loadGoals() {
      try {
        const data = await getMenteeGoals(userId);
        setGoals(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadGoals();
  }, [userId]);

  if (loading) return <div>Loading goals...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="space-y-2">
      {goals.map(goal => (
        <Card key={goal.id} className="p-4">
          <h4 className="font-semibold">{goal.title}</h4>
          <p className="text-gray-600">{goal.description}</p>
          <p className="text-sm text-gray-500">Frequency: {goal.frequency}</p>
        </Card>
      ))}
    </div>
  );
}
```

## Error Handling Best Practices

```typescript
function ComponentWithErrorHandling() {
  const { createMember, error } = useMember();
  const [localError, setLocalError] = useState('');

  const handleCreateMember = async (name) => {
    setLocalError(''); // Clear previous errors
    
    try {
      const member = await createMember(name);
      // Success handling
      return member;
    } catch (err) {
      // Show user-friendly error message
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setLocalError(message);
      
      // Log for debugging
      console.error('Member creation failed:', err);
      
      // Optionally notify user via toast
      // toast.error(message);
    }
  };

  return (
    <div>
      {(error || localError) && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
          {error || localError}
        </div>
      )}
      {/* Form inputs here */}
    </div>
  );
}
```

## Loading States

Always show loading indicators to improve UX:

```typescript
function ComponentWithLoadingState() {
  const { createMember, loading } = useMember();

  const handleCreate = async (name) => {
    await createMember(name);
  };

  return (
    <Button onClick={() => handleCreate('John')} disabled={loading}>
      {loading ? 'Creating...' : 'Create Member'}
    </Button>
  );
}
```

## Common Patterns

### Pattern 1: Load on Mount + Manual Refresh

```typescript
function ListComponent() {
  const { listMembers, loading } = useMember();
  const [members, setMembers] = useState([]);

  const loadMembers = async () => {
    const data = await listMembers();
    setMembers(data);
  };

  useEffect(() => {
    loadMembers();
  }, []);

  return (
    <div>
      <button onClick={loadMembers}>Refresh</button>
      {/* Display members */}
    </div>
  );
}
```

### Pattern 2: Optimistic Updates

```typescript
function EditableList() {
  const { updateMember } = useMember();
  const [members, setMembers] = useState([]);

  const handleUpdateMember = async (memberId, newName) => {
    // Optimistic update
    setMembers(members.map(m =>
      m.id === memberId ? { ...m, name: newName } : m
    ));

    try {
      await updateMember(memberId, { name: newName });
    } catch (err) {
      // Rollback on error
      const original = await getMember(memberId);
      setMembers(members.map(m =>
        m.id === memberId ? original : m
      ));
    }
  };
}
```

## Testing

When testing components that use these hooks, mock them:

```typescript
import { vitest } from 'vitest';
import { useMember } from '@/hooks';

vitest.mock('@/hooks', () => ({
  useMember: () => ({
    createMember: vitest.fn(async () => ({ id: '1', name: 'Test' })),
    listMembers: vitest.fn(async () => []),
    loading: false,
    error: null,
  }),
}));
```

## Debugging

Enable console logging for debugging:

```typescript
// In development, log API calls
const originalApi = api.post;
api.post = async (...args) => {
  console.log('POST request:', args);
  const result = await originalApi(...args);
  console.log('POST response:', result);
  return result;
};
```

## Performance Tips

1. **Avoid unnecessary re-renders:** Use `useCallback` for handlers
2. **Debounce search:** Limit API calls when searching members
3. **Pagination:** For large lists, implement pagination
4. **Caching:** Consider caching member lists locally

```typescript
// Example with useCallback
function MemberSearchForm() {
  const { listMembers } = useMember();
  const [search, setSearch] = useState('');

  const handleSearch = useCallback(async (term) => {
    const members = await listMembers();
    const filtered = members.filter(m =>
      m.name.toLowerCase().includes(term.toLowerCase())
    );
    // Handle results
  }, []);

  return (
    <input
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search members"
    />
  );
}
```

## Next Steps

1. **Integrate into existing pages:** Add member/mentor functionality to Profile.tsx, Home.tsx, etc.
2. **Add authentication:** Ensure only authorized users can access member/mentor endpoints
3. **Implement UI components:** Create dedicated member and mentor management screens
4. **Add validation:** Validate UUIDs and other inputs before sending to API
5. **Test thoroughly:** Test all CRUD operations and error scenarios

## Support

If you encounter issues:

1. **Check network tab:** Ensure requests are reaching http://localhost:8000
2. **Verify FastAPI is running:** Confirm the backend server is up
3. **Check browser console:** Look for JavaScript errors
4. **Review API response:** Use browser dev tools to inspect API responses
5. **Check backend logs:** Review FastAPI console output for errors
