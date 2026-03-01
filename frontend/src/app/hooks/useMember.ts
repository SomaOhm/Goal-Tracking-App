import { useState } from 'react';
import { members, Member } from '../api/client';

export function useMember() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMember = async (name: string, mentorId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const member = await members.create(name, mentorId);
      return member;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create member';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getMember = async (memberId: string) => {
    setLoading(true);
    setError(null);
    try {
      const member = await members.get(memberId);
      return member;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get member';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const memberList = await members.list();
      return memberList;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list members';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateMember = async (memberId: string, updates: { name?: string; mentor_id?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const member = await members.update(memberId, updates);
      return member;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update member';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    setLoading(true);
    setError(null);
    try {
      await members.delete(memberId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete member';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createMember,
    getMember,
    listMembers,
    updateMember,
    deleteMember,
  };
}
