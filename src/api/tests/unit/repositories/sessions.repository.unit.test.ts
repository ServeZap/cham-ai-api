import { describe, it, expect, beforeEach } from 'vitest';
import {
  SessionsRepository,
  Session,
  CreateSessionDTO,
  UpdateSessionDTO,
  SessionFilter,
} from '../../../services/repositories/sessions.repository.js';
import { createMockPool, MockPool } from '../../mocks/pg.mock.js';

describe('SessionsRepository', () => {
  let mockPool: MockPool & { query: any };
  let repository: SessionsRepository;

  const mockSession: Session = {
    id: '1',
    tenant_id: 'tenant-1',
    assistant_id: 'assistant-1',
    user_id: 'user-1',
    status: 'active',
    context: { messages: [], topic: 'test' },
    metadata: { source: 'web' },
    started_at: new Date(),
    ended_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockPool = createMockPool();
    repository = new SessionsRepository(mockPool);
  });

  describe('findAll', () => {
    it('should return paginated sessions for a tenant', async () => {
      const mockSessions = [mockSession, { ...mockSession, id: '2' }];
      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '2' }] });
      mockPool.setMockResponse('SELECT', { rows: mockSessions });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.sessions[0]).toEqual(mockSession);
    });

    it('should filter sessions by assistant_id', async () => {
      const mockSessions = [mockSession];
      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '1' }] });
      mockPool.setMockResponse('SELECT', { rows: mockSessions });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        assistant_id: 'assistant-1',
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("assistant_id = $2"),
        expect.any(Array)
      );
    });

    it('should filter sessions by user_id', async () => {
      const mockSessions = [mockSession];
      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '1' }] });
      mockPool.setMockResponse('SELECT', { rows: mockSessions });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("user_id = $2"),
        expect.any(Array)
      );
    });

    it('should filter sessions by status', async () => {
      const mockSessions = [mockSession];
      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '1' }] });
      mockPool.setMockResponse('SELECT', { rows: mockSessions });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        status: 'active',
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = $2"),
        expect.any(Array)
      );
    });

    it('should filter sessions by date range', async () => {
      const mockSessions = [mockSession];
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-12-31');

      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '1' }] });
      mockPool.setMockResponse('SELECT', { rows: mockSessions });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        from: fromDate,
        to: toDate,
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('created_at <='),
        expect.any(Array)
      );
    });

    it('should return empty array when no sessions found', async () => {
      mockPool.setMockResponse('SELECT COUNT', { rows: [{ total: '0' }] });
      mockPool.setMockResponse('SELECT', { rows: [] });

      const filter: SessionFilter = {
        tenant_id: 'tenant-1',
        page: 1,
        limit: 20,
      };

      const result = await repository.findAll(filter);

      expect(result.sessions).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return session when found', async () => {
      mockPool.setMockResponse('SELECT', { rows: [mockSession] });

      const result = await repository.findById('1');

      expect(result).toEqual(mockSession);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM sessions WHERE id = $1', ['1']);
    });

    it('should return null when not found', async () => {
      mockPool.setMockResponse('SELECT', { rows: [] });

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const createDto: CreateSessionDTO = {
        tenant_id: 'tenant-1',
        assistant_id: 'assistant-1',
        user_id: 'user-1',
        context: { messages: [], topic: 'greeting' },
        metadata: { source: 'web' },
      };

      const expectedSession: Session = {
        id: 'new-id',
        tenant_id: createDto.tenant_id,
        assistant_id: createDto.assistant_id,
        user_id: createDto.user_id || null,
        status: 'active',
        context: createDto.context || {},
        metadata: createDto.metadata || {},
        started_at: new Date(),
        ended_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.setMockResponse('INSERT INTO sessions', { rows: [expectedSession] });

      const result = await repository.create(createDto);

      expect(result).toEqual(expectedSession);
    });

    it('should create session with minimal required fields', async () => {
      const createDto: CreateSessionDTO = {
        tenant_id: 'tenant-1',
        assistant_id: 'assistant-1',
      };

      const expectedSession: Session = {
        id: 'new-id',
        tenant_id: createDto.tenant_id,
        assistant_id: createDto.assistant_id,
        user_id: null,
        status: 'active',
        context: {},
        metadata: {},
        started_at: new Date(),
        ended_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.setMockResponse('INSERT INTO sessions', { rows: [expectedSession] });

      const result = await repository.create(createDto);

      expect(result).toEqual(expectedSession);
    });
  });

  describe('update', () => {
    it('should update an existing session', async () => {
      const updateDto: UpdateSessionDTO = {
        status: 'closed',
        context: { messages: [...mockSession.context.messages, { role: 'assistant', content: 'Goodbye' }] },
      };

      const expectedSession: Session = {
        ...mockSession,
        status: updateDto.status,
        context: updateDto.context || mockSession.context,
        updated_at: new Date(),
      };

      mockPool.setMockResponse('UPDATE sessions', { rows: [expectedSession] });

      const result = await repository.update('1', updateDto);

      expect(result).toEqual(expectedSession);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions'),
        expect.arrayContaining([updateDto.status, updateDto.context, '1'])
      );
    });

    it('should update session with ended_at', async () => {
      const updateDto: UpdateSessionDTO = {
        status: 'closed',
        ended_at: new Date(),
      };

      const expectedSession: Session = {
        ...mockSession,
        status: updateDto.status,
        ended_at: updateDto.ended_at || null,
        updated_at: new Date(),
      };

      mockPool.setMockResponse('UPDATE sessions', { rows: [expectedSession] });

      const result = await repository.update('1', updateDto);

      expect(result).toEqual(expectedSession);
    });

    it('should return null when session not found for update', async () => {
      const updateDto: UpdateSessionDTO = {
        status: 'inactive',
      };

      mockPool.setMockResponse('UPDATE sessions', { rows: [] });

      const result = await repository.update('999', updateDto);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      mockPool.setMockResponse('DELETE FROM sessions', { rows: [], rowCount: 1 });

      const result = await repository.delete('1');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = $1', ['1']);
    });

    it('should return false when session not found for deletion', async () => {
      mockPool.setMockResponse('DELETE FROM sessions', { rows: [], rowCount: 0 });

      const result = await repository.delete('999');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when session exists', async () => {
      mockPool.setMockResponse('SELECT EXISTS', { rows: [{ exists: true }] });

      const result = await repository.exists('1');

      expect(result).toBe(true);
    });

    it('should return false when session does not exist', async () => {
      mockPool.setMockResponse('SELECT EXISTS', { rows: [{ exists: false }] });

      const result = await repository.exists('999');

      expect(result).toBe(false);
    });
  });

  describe('endInactiveSessions', () => {
    it('should end sessions inactive for specified timeout', async () => {
      const mockEndedSessions = [{ id: '1' }, { id: '2' }];
      mockPool.setMockResponse('UPDATE sessions', { rows: mockEndedSessions });

      const result = await repository.endInactiveSessions(30);

      expect(result).toBe(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('30 minutes'),
        undefined
      );
    });

    it('should use custom timeout value', async () => {
      const mockEndedSessions = [{ id: '1' }];
      mockPool.setMockResponse('UPDATE sessions', { rows: mockEndedSessions });

      const result = await repository.endInactiveSessions(60);

      expect(result).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('60 minutes'),
        undefined
      );
    });

    it('should return 0 when no inactive sessions found', async () => {
      mockPool.setMockResponse('UPDATE sessions', { rows: [] });

      const result = await repository.endInactiveSessions(30);

      expect(result).toBe(0);
    });
  });

  describe('getWithMessageCount', () => {
    it('should get session with message count', async () => {
      const mockSessionWithCount = {
        ...mockSession,
        message_count: 15,
      };

      mockPool.setMockResponse('SELECT', { rows: [mockSessionWithCount] });

      const result = await repository.getWithMessageCount('1');

      expect(result).toEqual(mockSessionWithCount);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN messages m ON m.session_id = s.id'),
        ['1']
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(m.id) as message_count'),
        ['1']
      );
    });

    it('should return null when session not found', async () => {
      mockPool.setMockResponse('SELECT', { rows: [] });

      const result = await repository.getWithMessageCount('999');

      expect(result).toBeNull();
    });

    it('should return 0 message count when no messages', async () => {
      const mockSessionWithCount = {
        ...mockSession,
        message_count: 0,
      };

      mockPool.setMockResponse('SELECT', { rows: [mockSessionWithCount] });

      const result = await repository.getWithMessageCount('1');

      expect(result?.message_count).toBe(0);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions older than specified days', async () => {
      const mockDeletedSessions = [{ id: '1' }, { id: '2' }, { id: '3' }];
      mockPool.setMockResponse('DELETE FROM sessions', { rows: mockDeletedSessions });

      const result = await repository.cleanupOldSessions(30);

      expect(result).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('30 days'),
        undefined
      );
    });

    it('should use custom days value', async () => {
      const mockDeletedSessions = [{ id: '1' }];
      mockPool.setMockResponse('DELETE FROM sessions', { rows: mockDeletedSessions });

      const result = await repository.cleanupOldSessions(60);

      expect(result).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('60 days'),
        undefined
      );
    });

    it('should return 0 when no old sessions found', async () => {
      mockPool.setMockResponse('DELETE FROM sessions', { rows: [] });

      const result = await repository.cleanupOldSessions(30);

      expect(result).toBe(0);
    });
  });
});
