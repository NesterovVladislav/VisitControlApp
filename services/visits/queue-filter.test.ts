import { loadQueueFilter, QueueFilterStore, saveQueueFilter } from './queue-filter';

function memoryStore(initial: Record<string, string> = {}): QueueFilterStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
    removeItem: async (key) => {
      delete data[key];
    },
  };
}

describe('queue filter on the device', () => {
  it('keeps the chosen groups for each user separately', async () => {
    const store = memoryStore();
    await saveQueueFilter('teacher', { groupIds: ['g-sun'], withoutGroup: true }, store);

    expect(await loadQueueFilter('teacher', store)).toEqual({ groupIds: ['g-sun'], withoutGroup: true });
    expect(await loadQueueFilter('other', store)).toBeNull();
  });

  it('forgets the choice when the whole queue is chosen', async () => {
    const store = memoryStore();
    await saveQueueFilter('teacher', { groupIds: ['g-sun'], withoutGroup: false }, store);
    await saveQueueFilter('teacher', null, store);

    expect(await loadQueueFilter('teacher', store)).toBeNull();
  });

  it('treats a damaged value as no choice', async () => {
    const store = memoryStore({ 'visit-queue-filter:teacher': '{"groupIds":"oops"}' });

    expect(await loadQueueFilter('teacher', store)).toBeNull();
    expect(await loadQueueFilter('teacher', memoryStore({ 'visit-queue-filter:teacher': 'not json' }))).toBeNull();
  });
});
