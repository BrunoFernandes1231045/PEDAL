jest.mock('../../src/db/supabase', () => ({
  rpc: jest.fn(),
  auth: {
    admin: {
      inviteUserByEmail: jest.fn(),
      updateUserById: jest.fn(),
      deleteUser: jest.fn(),
      listUsers: jest.fn(),
    },
  },
}));

jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireCoordinator: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const supabase = require('../../src/db/supabase');
const router = require('../../src/routes/coordUsers');

const app = express();
app.use(express.json());
app.use('/api/coord-users', router);

describe('coord-users secure invitations (PED-59)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_URL = 'https://pedal.example';
    delete process.env.COORDINATOR_INVITE_REDIRECT_URL;
    supabase.auth.admin.deleteUser.mockResolvedValue({ error: null });
    supabase.rpc.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.COORDINATOR_INVITE_REDIRECT_URL;
  });

  it('sends a one-use invitation and never creates or returns a password', async () => {
    supabase.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: {
        user: {
          id: 'coord-1',
          email: 'ana@example.org',
          app_metadata: { provider: 'email' },
        },
      },
      error: null,
    });
    supabase.auth.admin.updateUserById.mockResolvedValue({ error: null });

    const response = await request(app)
      .post('/api/coord-users')
      .send({ name: 'Ana Silva', email: 'ANA@example.org', phone: '910000000', role: 'Administração' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 'coord-1',
      email: 'ana@example.org',
      invitationSent: true,
      coordRole: 'administracao',
    });
    expect(response.body).not.toHaveProperty('tempPassword');
    expect(response.body).not.toHaveProperty('password');
    expect(supabase.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      'ana@example.org',
      {
        data: { name: 'Ana Silva', phone: '910000000' },
        redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      }
    );
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'coord-1',
      {
        app_metadata: expect.objectContaining({
          role: 'coordinator',
          coord_role: 'administracao',
          authorization_version: expect.any(String),
        }),
      }
    );
  });

  it('fails closed when the invitation redirect is not configured', async () => {
    delete process.env.PUBLIC_APP_URL;

    const response = await request(app)
      .post('/api/coord-users')
      .send({ name: 'Ana Silva', email: 'ana@example.org', role: 'Coordenação' });

    expect(response.status).toBe(503);
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('deletes an invited account when secure app_metadata cannot be applied', async () => {
    supabase.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'coord-2', app_metadata: {} } },
      error: null,
    });
    supabase.auth.admin.updateUserById.mockResolvedValue({ error: new Error('metadata failure') });

    const response = await request(app)
      .post('/api/coord-users')
      .send({ name: 'Bruno', email: 'bruno@example.org', role: 'Coordenação' });

    expect(response.status).toBe(500);
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('coord-2');
  });

  it('invalidates existing sessions when an administrator changes a role', async () => {
    supabase.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{
          id: 'coord-3',
          email: 'coord@example.org',
          app_metadata: { role: 'coordinator', coord_role: 'coordenacao' },
        }],
      },
      error: null,
    });
    supabase.auth.admin.updateUserById.mockResolvedValue({ error: null });

    const response = await request(app)
      .patch('/api/coord-users/coord%40example.org')
      .send({ role: 'Administração' });

    expect(response.status).toBe(200);
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'coord-3',
      {
        app_metadata: expect.objectContaining({
          role: 'coordinator',
          coord_role: 'administracao',
          authorization_version: expect.any(String),
        }),
      }
    );
    expect(supabase.rpc).toHaveBeenCalledWith('invalidate_user_auth_sessions', {
      target_user_id: 'coord-3',
    });
  });
});
