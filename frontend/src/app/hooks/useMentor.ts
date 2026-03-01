import { useState } from 'react';
import { mentors, MentorInfo, Patient, MenteeGoal } from '../api/client';

export function useMentor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignMentor = async (userId: string, mentorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const mentor = await mentors.assign(userId, mentorId);
      return mentor;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign mentor';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getMentorPatients = async (mentorId: string) => {
    setLoading(true);
    setError(null);
    try {
      const patients = await mentors.getPatients(mentorId);
      return patients;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get mentor patients';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getMenteeGoals = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const goals = await mentors.getMenteeGoals(userId);
      return goals;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get mentee goals';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    assignMentor,
    getMentorPatients,
    getMenteeGoals,
  };
}
