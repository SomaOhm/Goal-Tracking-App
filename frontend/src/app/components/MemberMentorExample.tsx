import React, { useState, useEffect } from 'react';
import { useMember, useMentor } from '../hooks';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Users, UserPlus, AlertCircle } from 'lucide-react';

/**
 * Example component demonstrating member and mentor API integration.
 * 
 * This component shows how to:
 * 1. Create members via the FastAPI backend
 * 2. Manage mentor assignments
 * 3. Retrieve mentee goals
 * 4. Handle loading and error states
 * 
 * Usage:
 * Import this component into a page and it will display member management UI
 * connected to the FastAPI backend.
 */

export const MemberMentorExample: React.FC = () => {
  const {
    loading: memberLoading,
    error: memberError,
    createMember,
    listMembers,
    getMember,
    updateMember,
    deleteMember,
  } = useMember();

  const {
    loading: mentorLoading,
    error: mentorError,
    assignMentor,
    getMentorPatients,
    getMenteeGoals,
  } = useMentor();

  const [members, setMembers] = useState<any[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [mentorId, setMentorId] = useState('');
  const [menteeGoals, setMenteeGoals] = useState<any[]>([]);
  const [showGoalsDialog, setShowGoalsDialog] = useState(false);

  const error = memberError || mentorError;
  const loading = memberLoading || mentorLoading;

  // Load members on component mount
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const membersList = await listMembers();
      setMembers(membersList);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleCreateMember = async () => {
    if (!memberName.trim()) return;

    try {
      const newMember = await createMember(memberName);
      setMembers([...members, newMember]);
      setMemberName('');
      setCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create member:', err);
    }
  };

  const handleAssignMentor = async (memberId: string) => {
    if (!mentorId.trim()) return;

    try {
      const result = await assignMentor(memberId, mentorId);
      // Update member in list
      await loadMembers();
      setMentorId('');
    } catch (err) {
      console.error('Failed to assign mentor:', err);
    }
  };

  const handleViewGoals = async (memberId: string) => {
    try {
      const goals = await getMenteeGoals(memberId);
      setMenteeGoals(goals);
      setShowGoalsDialog(true);
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      await deleteMember(memberId);
      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Member Management
        </h2>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Members List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {members.map(member => (
          <Card key={member.id} className="p-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{member.name}</h3>
                <p className="text-sm text-gray-500">
                  ID: {member.id.substring(0, 8)}...
                </p>
              </div>

              <div>
                {member.mentor_id ? (
                  <p className="text-sm text-green-600">
                    ✓ Mentor Assigned: {member.mentor_id.substring(0, 8)}...
                  </p>
                ) : (
                  <p className="text-sm text-yellow-600">No mentor assigned</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Mentor ID (UUID)"
                    value={mentorId}
                    onChange={(e) => setMentorId(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    onClick={() => handleAssignMentor(member.id)}
                    disabled={loading || !mentorId}
                    variant="outline"
                  >
                    Assign
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleViewGoals(member.id)}
                    disabled={loading}
                    variant="secondary"
                  >
                    View Goals
                  </Button>
                  <Button
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={loading}
                    variant="destructive"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {members.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No members found. Create one to get started.
        </Card>
      )}

      {/* Create Member Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Member Name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateMember();
              }}
            />
            <Button
              onClick={handleCreateMember}
              disabled={loading || !memberName.trim()}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Goals Dialog */}
      <Dialog open={showGoalsDialog} onOpenChange={setShowGoalsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mentee Goals</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {menteeGoals.length > 0 ? (
              menteeGoals.map(goal => (
                <Card key={goal.id} className="p-3">
                  <h4 className="font-semibold">{goal.title}</h4>
                  <p className="text-sm text-gray-600">{goal.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Frequency: {goal.frequency}
                  </p>
                </Card>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No goals found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberMentorExample;
