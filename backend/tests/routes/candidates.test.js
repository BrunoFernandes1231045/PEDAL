jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return {
    from: jest.fn(() => chain),
    rpc: jest.fn(),
    auth: {
      admin: {
        inviteUserByEmail: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  };
});
jest.mock('../../src/lib/turnstile', () => ({ verifyTurnstile: jest.fn() }));
let mockUser = { id: 'cand-1', role: 'candidate' };
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockUser; next(); },
  requireCoordinator: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  attachOwnCandidateId: (req, res, next) => { req.ownCandidateId = req.user.role === 'coordinator' ? null : req.user.id; next(); },
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');
const { verifyTurnstile } = require('../../src/lib/turnstile');

beforeEach(() => {
  mockUser = { id: 'cand-1', role: 'candidate' };
  process.env.PUBLIC_APP_URL = 'https://pedal.example';
  process.env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  const chain = supabase.from();
  chain.select.mockReset().mockReturnThis();
  chain.insert.mockReset().mockReturnThis();
  chain.update.mockReset().mockReturnThis();
  chain.eq.mockReset().mockReturnThis();
  chain.single.mockReset();
  supabase.rpc.mockReset().mockResolvedValue({
    data: { limited: false, retryAfter: 0 },
    error: null,
  });
  supabase.auth.admin.inviteUserByEmail.mockReset().mockResolvedValue({
    data: { user: { id: 'auth-user-1' } },
    error: null,
  });
  supabase.auth.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null });
  supabase.auth.admin.deleteUser.mockReset().mockResolvedValue({ data: {}, error: null });
  verifyTurnstile.mockReset().mockResolvedValue({ success: true });
});

describe('POST /api/candidates', () => {
  const validCandidate = {
    name: 'Maria',
    email: 'Maria@Test.com',
    dob: '1950-01-01',
    phone: '912345678',
    turnstileToken: 'turnstile-ok',
  };

  it('creates an invited candidate without accepting or returning a password', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', name: 'Maria', email: 'maria@test.com', stage: 'inscricao' },
      error: null,
    });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(202);
    expect(res.body).toEqual(expect.objectContaining({ emailVerificationRequired: true }));
    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('user_id');
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('initialPassword');
    expect(res.body).not.toHaveProperty('token');

    expect(supabase.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      'maria@test.com',
      expect.objectContaining({
        redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite',
      }),
    );
    const inviteOptions = supabase.auth.admin.inviteUserByEmail.mock.calls[0][1];
    expect(inviteOptions).not.toHaveProperty('password');
    expect(inviteOptions.data).not.toHaveProperty('role');
    expect(supabase.auth.admin.updateUserById).toHaveBeenCalledWith(
      'auth-user-1',
      expect.objectContaining({ app_metadata: expect.objectContaining({ role: 'candidate' }) }),
    );
    expect(supabase.from().insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@test.com', user_id: 'auth-user-1', stage: 'inscricao' }),
    );
  });

  it('does not accept a password in the public registration request', async () => {
    const res = await request(app).post('/api/candidates').send({
      ...validCandidate,
      password: 'tentativa-do-cliente',
    });

    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 400 when name or email missing', async () => {
    const res = await request(app).post('/api/candidates').send({ name: 'Maria' });
    expect(res.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('does not consume the email bucket for missing or invalid anti-bot tokens', async () => {
    verifyTurnstile.mockResolvedValue({ success: false, errorCodes: ['invalid-input-response'] });

    const missing = await request(app).post('/api/candidates').send({
      ...validCandidate,
      turnstileToken: undefined,
    });
    const invalid = await request(app).post('/api/candidates').send({
      ...validCandidate,
      turnstileToken: 'invalid-token',
    });

    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls.every((call) => call[1].p_identifier_hashes.length === 1)).toBe(true);
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('fails closed if Turnstile is unavailable', async () => {
    verifyTurnstile.mockResolvedValue({ success: false, serviceError: true });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(503);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 429 before Siteverify when the pre-CAPTCHA IP bucket is exhausted', async () => {
    supabase.rpc.mockResolvedValue({
      data: { limited: true, retryAfter: 2875 },
      error: null,
    });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('2875');
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('returns 429 after Siteverify when the IP/email signup bucket is exhausted', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: { limited: false, retryAfter: 0 }, error: null })
      .mockResolvedValueOnce({ data: { limited: true, retryAfter: 1200 }, error: null });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('1200');
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(supabase.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('blocks repeated valid challenges after the configured shared limit', async () => {
    let hits = 0;
    supabase.rpc.mockImplementation(async (_name, args) => {
      if (args.p_identifier_hashes.length === 1) {
        return { data: { limited: false, retryAfter: 0 }, error: null };
      }
      hits += 1;
      return { data: { limited: hits > 5, retryAfter: hits > 5 ? 3600 : 0 }, error: null };
    });
    supabase.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { status: 422, code: 'email_exists', message: 'already registered' },
    });

    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await request(app).post('/api/candidates').send({
        ...validCandidate,
        turnstileToken: `valid-token-${i}`,
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
    expect(supabase.auth.admin.inviteUserByEmail).toHaveBeenCalledTimes(5);
  });

  it('fails closed when the shared rate limiter is unavailable', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'migration missing' } });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(503);
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it('uses separate pre-IP and atomic IP/email hashed buckets', async () => {
    supabase.from().single.mockResolvedValue({ data: { id: 'cand-1' }, error: null });

    await request(app)
      .post('/api/candidates')
      .set('X-Forwarded-For', '203.0.113.10')
      .send(validCandidate);

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    const preArgs = supabase.rpc.mock.calls[0][1];
    const signupArgs = supabase.rpc.mock.calls[1][1];
    expect(preArgs.p_identifier_hashes).toHaveLength(1);
    expect(signupArgs.p_identifier_hashes).toHaveLength(2);
    expect([...preArgs.p_identifier_hashes, ...signupArgs.p_identifier_hashes]
      .every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    expect(JSON.stringify([preArgs, signupArgs])).not.toContain('203.0.113.10');
    expect(JSON.stringify([preArgs, signupArgs])).not.toContain('maria@test.com');
    expect(verifyTurnstile).toHaveBeenCalledWith(expect.objectContaining({
      expectedAction: null, // só é imposto em produção
      secretKey: 'test-secret',
    }));
  });

  it('rejects malformed and oversized optional fields before security services', async () => {
    const invalidType = await request(app).post('/api/candidates').send({
      ...validCandidate,
      phone: { value: '912345678' },
    });
    const oversized = await request(app).post('/api/candidates').send({
      ...validCandidate,
      name: 'x'.repeat(121),
    });

    expect(invalidType.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it('rejects a registration body larger than the route-specific 32 KB limit', async () => {
    const res = await request(app).post('/api/candidates').send({
      ...validCandidate,
      name: 'x'.repeat(40 * 1024),
    });

    expect(res.status).toBe(413);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it('returns the same generic response for a duplicate email', async () => {
    supabase.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { status: 422, code: 'email_exists', message: 'already registered' },
    });

    const duplicate = await request(app).post('/api/candidates').send(validCandidate);

    expect(duplicate.status).toBe(202);
    expect(duplicate.body).not.toHaveProperty('id');
    expect(supabase.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(supabase.from().insert).not.toHaveBeenCalled();
  });

  it('deletes the invited Auth user if app_metadata cannot be secured', async () => {
    supabase.auth.admin.updateUserById.mockResolvedValue({
      data: null,
      error: { message: 'metadata failed' },
    });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(500);
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('auth-user-1');
    expect(supabase.from().insert).not.toHaveBeenCalled();
  });

  it('deletes the invited Auth user if profile creation fails', async () => {
    supabase.from().single.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'database failed' },
    });

    const res = await request(app).post('/api/candidates').send(validCandidate);

    expect(res.status).toBe(500);
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith('auth-user-1');
  });
});

describe('GET /api/candidates/signup-config', () => {
  it('exposes only the public site key', async () => {
    const res = await request(app).get('/api/candidates/signup-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      turnstileSiteKey: '1x00000000000000000000AA',
      registrationAvailable: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('test-secret');
  });
});

describe('GET /api/candidates', () => {
  it('returns list of candidates for coordinator', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'cand-1', name: 'Maria' }], error: null,
    });
    const res = await request(app)
      .get('/api/candidates')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/candidates/:id', () => {
  it('returns candidate data', async () => {
    // A 1ª chamada a single() é a verificação de dono (PED-58) — a 2ª é a
    // leitura em si; user_id tem de bater com req.user.id ('cand-1').
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1', name: 'Maria', stage: 'triagem' }, error: null });
    const res = await request(app)
      .get('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Maria');
  });

  it('returns 403 for another candidate\'s record (PED-58)', async () => {
    supabase.from().single.mockResolvedValueOnce({ data: { user_id: 'cand-OUTRO' }, error: null });
    const res = await request(app)
      .get('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/candidates/:id', () => {
  it('updates candidate data', async () => {
    // 1ª single(): verificação de dono. 2ª: leitura do stage atual (para
    // stage_since). 3ª: resultado do update em si.
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { stage: 'inscricao' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1', stage: 'triagem' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'triagem' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('triagem');
  });

  it('rejects an attempt to jump directly to an administrative stage', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { stage: 'inscricao' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'ativo' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_stage_transition');
    const chain = supabase.from();
    expect(chain.update).not.toHaveBeenCalled();
  });

  it('rejects administrative fields instead of silently ignoring them', async () => {
    supabase.from().single.mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ user_id: 'auth-user-OUTRO', name: 'Nome adulterado' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(expect.arrayContaining(['user_id', 'name']));
    expect(supabase.from().update).not.toHaveBeenCalled();
  });

  it('also applies an allowlist to coordinator updates', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'administracao' };

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'onboarding', user_id: 'auth-user-OUTRO', email: 'alterado@example.org' });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(expect.arrayContaining(['user_id', 'email']));
    expect(supabase.from().update).not.toHaveBeenCalled();
  });

  it('rejects a backwards or skipped self-service transition', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { stage: 'triagem' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'validacao' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_stage_transition');
  });

  it('sanitizes candidate chat messages so coordinator authorship cannot be forged', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1' }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        chat_messages: [{
          from: 'agent',
          text: 'Mensagem forjada',
          coord: true,
          coordAuthor: 'Administração',
          authorRole: 'coordinator',
        }],
      });

    expect(res.status).toBe(200);
    const payload = supabase.from().update.mock.calls[0][0];
    expect(payload.chat_messages[0]).toEqual({
      from: 'agent',
      text: 'Mensagem forjada',
      client_unverified: true,
    });
  });

  it('preserves coordinator authorship only for a matching answered contact request', async () => {
    const chain = supabase.from();
    chain.eq.mockImplementation(function mockEq(field) {
      if (field === 'status') {
        return Promise.resolve({
          data: [{ answer: 'Resposta confirmada', answered_by: 'Coordenação' }],
          error: null,
        });
      }
      return this;
    });
    chain.single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1' }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        chat_messages: [{
          from: 'agent',
          text: 'Resposta confirmada',
          coord: true,
          coordAuthor: 'Coordenação',
        }],
      });

    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      chat_messages: [{
        from: 'agent',
        text: 'Resposta confirmada',
        coord: true,
        coordAuthor: 'Coordenação',
        client_unverified: false,
        authorTrust: 'contact_request',
      }],
    }));
  });

  it('preserves administrative scheduling fields when a candidate chooses a slot', async () => {
    const currentScheduling = {
      slots: [{ date: '2026-09-10', startTime: '10:00', state: 'proposto' }],
      trainerId: 'trainer-1',
      stationId: 'station-1',
      status: 'aguarda_candidato',
    };
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { scheduling: currentScheduling }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1' }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        scheduling: {
          ...currentScheduling,
          slots: [{ ...currentScheduling.slots[0], state: 'selecionado' }],
          status: 'aguarda_coordenacao',
        },
      });

    expect(res.status).toBe(200);
    expect(supabase.from().update).toHaveBeenCalledWith(expect.objectContaining({
      scheduling: expect.objectContaining({
        trainerId: 'trainer-1',
        stationId: 'station-1',
        status: 'aguarda_coordenacao',
        slots: [{ date: '2026-09-10', startTime: '10:00', state: 'selecionado' }],
      }),
    }));
  });

  it('rejects an attempt to replace coordinator-controlled scheduling fields', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({
        data: {
          scheduling: {
            slots: [{ date: '2026-09-10', startTime: '10:00' }],
            trainerId: 'trainer-1',
            stationId: 'station-1',
          },
        },
        error: null,
      });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({
        scheduling: {
          trainerId: 'trainer-atacante',
          stationId: 'station-1',
          chosen: 0,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('trainerId');
    expect(supabase.from().update).not.toHaveBeenCalled();
  });

  it('adds a reschedule request without erasing the confirmed booking', async () => {
    const currentScheduling = {
      slots: [{ date: '2026-09-10', startTime: '10:00', state: 'confirmado' }],
      chosen: 0,
      trainerId: 'trainer-1',
      stationId: 'station-1',
      status: 'confirmado',
    };
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { scheduling: currentScheduling }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1' }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ scheduling: { rescheduleRequested: true, slots: [], chosen: null, status: null } });

    expect(res.status).toBe(200);
    expect(supabase.from().update).toHaveBeenCalledWith(expect.objectContaining({
      scheduling: {
        ...currentScheduling,
        rescheduleRequested: true,
      },
    }));
  });

  it('requires a complete interview before transitioning to validation', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { stage: 'entrevista', interview: {} }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'validacao', interview: { conhecimento: 'Internet' } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('stage_prerequisite_missing');
    expect(supabase.from().update).not.toHaveBeenCalled();
  });

  it('accepts the transition to validation atomically with a complete interview', async () => {
    const interview = {
      conhecimento: 'Internet',
      voluntariado: 'Não',
      bicicleta: 'Sim',
      carta: 'Não',
    };
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1' }, error: null })
      .mockResolvedValueOnce({ data: { stage: 'entrevista', interview: {} }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1', stage: 'validacao', interview }, error: null });

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'validacao', interview });

    expect(res.status).toBe(200);
    expect(supabase.from().update).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'validacao',
      interview,
    }));
  });

  it('rejects an unknown coordinator stage', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };

    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'estado-inventado' });

    expect(res.status).toBe(400);
    expect(supabase.from().update).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/candidates/:id/formalize', () => {
  it('sets nif, signature and stage to ativo', async () => {
    supabase.from().single
      .mockResolvedValueOnce({ data: { user_id: 'cand-1', stage: 'formalizacao' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'cand-1', stage: 'ativo', nif: '123456789' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789', signature: 'sig-base64' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('ativo');
  });

  it('returns 403 when trying to formalize another candidate (PED-58)', async () => {
    supabase.from().single.mockResolvedValueOnce({ data: { user_id: 'cand-OUTRO', stage: 'formalizacao' }, error: null });
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ signature: 'sig-base64' });
    expect(res.status).toBe(403);
  });

  it('cannot jump from registration directly to active through formalization', async () => {
    supabase.from().single.mockResolvedValueOnce({
      data: { user_id: 'cand-1', stage: 'inscricao' },
      error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ signature: 'sig-base64' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_stage_transition');
    expect(supabase.from().update).not.toHaveBeenCalled();
  });

  it('returns 400 when nif or signature missing', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789' });
    expect(res.status).toBe(400);
  });
});
