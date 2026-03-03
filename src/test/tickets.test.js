import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseTicket, getUserTicketForEvent } from '../supabase/tickets';

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../supabase/client';

describe('purchaseTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna erro quando usuário não está autenticado', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { data, error } = await purchaseTicket({
      eventId: 'evt-1',
      price: 50,
      attendeeName: 'João',
      attendeeEmail: 'joao@test.com',
    });

    expect(data).toBeUndefined();
    expect(error).toBeTruthy();
    expect(error.message).toBe('Não autenticado');
  });

  it('retorna erro de autenticação quando getUser falha', async () => {
    const authError = new Error('Token inválido');
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: authError,
    });

    const { error } = await purchaseTicket({
      eventId: 'evt-1',
      price: 50,
      attendeeName: 'João',
      attendeeEmail: 'joao@test.com',
    });

    expect(error).toBe(authError);
  });

  it('cria ingresso com sucesso', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const mockTicket = { id: 'ticket-1', qr_code: 'VB-ABCDE-FGHIJ', status: 'active' };
    const singleMock = vi.fn().mockResolvedValue({ data: mockTicket, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    supabase.from.mockReturnValue({ insert: insertMock });

    const { data, error } = await purchaseTicket({
      eventId: 'evt-1',
      price: 50,
      attendeeName: 'João',
      attendeeEmail: 'joao@test.com',
    });

    expect(error).toBeNull();
    expect(data).toEqual(mockTicket);
    expect(data.id).toBe('ticket-1');
  });

  it('repassa erro do banco quando insert falha', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const dbError = { message: 'duplicate key value', code: '23505' };
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: dbError });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    supabase.from.mockReturnValue({ insert: insertMock });

    const { data, error } = await purchaseTicket({
      eventId: 'evt-1',
      price: 50,
      attendeeName: 'João',
      attendeeEmail: 'joao@test.com',
    });

    expect(data).toBeNull();
    expect(error).toBe(dbError);
  });

  it('gera qr_code com formato VB-XXXXX-XXXXX', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    let capturedInsertPayload = null;
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'ticket-1' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockImplementation((payload) => {
      capturedInsertPayload = payload;
      return { select: selectMock };
    });
    supabase.from.mockReturnValue({ insert: insertMock });

    await purchaseTicket({
      eventId: 'evt-1',
      price: 0,
      attendeeName: 'Maria',
      attendeeEmail: 'maria@test.com',
    });

    expect(capturedInsertPayload.qr_code).toMatch(/^VB-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });
});

describe('getUserTicketForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna null quando usuário não está autenticado', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const { data, error } = await getUserTicketForEvent('evt-1');

    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it('retorna ingresso existente', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const mockTicket = { id: 'ticket-1', status: 'active' };
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockTicket, error: null });
    const neqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq2Mock = vi.fn().mockReturnValue({ neq: neqMock });
    const eq1Mock = vi.fn().mockReturnValue({ eq: eq2Mock });
    const selectMock = vi.fn().mockReturnValue({ eq: eq1Mock });
    supabase.from.mockReturnValue({ select: selectMock });

    const { data } = await getUserTicketForEvent('evt-1');

    expect(data).toEqual(mockTicket);
  });
});
