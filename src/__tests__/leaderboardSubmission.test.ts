import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock('../utils/supabaseClient', () => ({ getSupabaseClient: () => ({ functions: { invoke: mocks.invoke }, from: mocks.from, rpc: mocks.rpc }) }));
import { submitGameRun } from '../utils/leaderboardApi';
const run = { gameSessionId: 'test-run', playerId: 'test-player', playerName: '  Student Name  ', score: 120, wpm: 35, accuracy: 96 };
beforeEach(() => vi.clearAllMocks());
describe('Cloud score submission', () => {
  it('sends the actual student name and stable session ID to the validated endpoint', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true, alreadyRecorded: false }, error: null });
    expect((await submitGameRun(run)).success).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith('submit-score', { body: expect.objectContaining({ playerName: 'Student Name', playerId: 'test-player', gameSessionId: 'test-run', score: 120 }) });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects a failed save instead of fabricating a leaderboard record', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: false }, error: null });
    await expect(submitGameRun(run)).rejects.toThrow('Could not save');
  });
  it('surfaces endpoint failures without attempting unsafe direct table writes', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(submitGameRun(run)).rejects.toThrow('Could not save');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('retries with the same session ID so an acknowledged duplicate is safe', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error('response lost') })
      .mockResolvedValueOnce({ data: { success: true, alreadyRecorded: true }, error: null });
    await expect(submitGameRun(run)).rejects.toThrow();
    expect((await submitGameRun(run)).alreadyRecorded).toBe(true);
    expect(mocks.invoke.mock.calls[0][1].body.gameSessionId).toBe(mocks.invoke.mock.calls[1][1].body.gameSessionId);
  });
});
