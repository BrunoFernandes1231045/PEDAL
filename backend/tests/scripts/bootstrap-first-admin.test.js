const {
  BootstrapError,
  PAGE_SIZE,
  bootstrapFirstAdmin,
  listAllUsers,
  maskEmail,
  normaliseInput,
  parseArgs,
} = require('../../scripts/bootstrap-first-admin');

function clientMock() {
  return {
    auth: {
      admin: {
        listUsers: jest.fn(),
        inviteUserByEmail: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  };
}

describe('bootstrap-first-admin', () => {
  it('requires an explicit --confirm flag before making requests', async () => {
    const client = clientMock();
    await expect(bootstrapFirstAdmin({
      client,
      email: 'admin@example.org',
      name: 'Admin',
      redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      confirm: false,
    })).rejects.toMatchObject({ code: 'confirmation_required' });
    expect(client.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it('reads every Auth page and refuses when any administrator exists', async () => {
    const client = clientMock();
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, index) => ({
      id: `candidate-${index}`,
      app_metadata: { role: 'candidate' },
    }));
    client.auth.admin.listUsers
      .mockResolvedValueOnce({ data: { users: firstPage }, error: null })
      .mockResolvedValueOnce({
        data: {
          users: [{
            id: 'existing-admin',
            app_metadata: { role: 'coordinator', coord_role: 'administracao' },
          }],
        },
        error: null,
      });

    await expect(bootstrapFirstAdmin({
      client,
      email: 'new-admin@example.org',
      name: 'Nova Administração',
      redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      confirm: true,
    })).rejects.toMatchObject({ code: 'administrator_exists' });

    expect(client.auth.admin.listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: PAGE_SIZE });
    expect(client.auth.admin.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: PAGE_SIZE });
    expect(client.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('sends a one-use invite and writes only trusted authorization metadata', async () => {
    const client = clientMock();
    client.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    client.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: {
        user: {
          id: 'first-admin',
          app_metadata: { provider: 'email' },
        },
      },
      error: null,
    });
    client.auth.admin.updateUserById.mockResolvedValue({ error: null });

    const result = await bootstrapFirstAdmin({
      client,
      email: 'admin@example.org',
      name: 'Admin Associação',
      redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      confirm: true,
      randomUUID: () => 'fixed-authorization-version',
    });

    expect(result).toEqual({ userId: 'first-admin', email: 'admin@example.org' });
    expect(client.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      'admin@example.org',
      {
        data: { name: 'Admin Associação' },
        redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      },
    );
    const invitePayload = client.auth.admin.inviteUserByEmail.mock.calls[0][1];
    expect(JSON.stringify(invitePayload)).not.toMatch(/password/i);
    expect(JSON.stringify(invitePayload.data)).not.toMatch(/role|coord_role/i);
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith('first-admin', {
      app_metadata: {
        provider: 'email',
        role: 'coordinator',
        coord_role: 'administracao',
        authorization_version: 'fixed-authorization-version',
      },
    });
  });

  it('removes the invited account when app_metadata cannot be applied', async () => {
    const client = clientMock();
    client.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    client.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'unsafe-account', app_metadata: {} } },
      error: null,
    });
    client.auth.admin.updateUserById.mockResolvedValue({ error: new Error('failed') });
    client.auth.admin.deleteUser.mockResolvedValue({ error: null });

    await expect(bootstrapFirstAdmin({
      client,
      email: 'admin@example.org',
      name: 'Admin Associação',
      redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
      confirm: true,
    })).rejects.toMatchObject({ code: 'metadata_failed_compensated' });

    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith('unsafe-account');
  });

  it('normalises input and only accepts the coordinator activation redirect', () => {
    expect(normaliseInput({
      email: ' ADMIN@Example.ORG ',
      name: '  Admin Associação ',
      publicAppUrl: 'https://pedal.example/',
    })).toEqual({
      email: 'admin@example.org',
      name: 'Admin Associação',
      redirectTo: 'https://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
    });
    expect(() => normaliseInput({
      email: 'admin@example.org',
      name: 'Admin',
      redirectUrl: 'http://pedal.example/nova-palavra-passe?tipo=convite-coordenacao',
    })).toThrow(BootstrapError);
  });

  it('parses only the documented arguments and masks log email addresses', async () => {
    expect(parseArgs([
      '--confirm',
      '--email', 'admin@example.org',
      '--name', 'Admin',
    ])).toEqual({
      confirm: true,
      email: 'admin@example.org',
      name: 'Admin',
    });
    expect(() => parseArgs(['--force'])).toThrow(BootstrapError);
    expect(maskEmail('administrator@example.org')).toBe('ad***********@example.org');

    const client = clientMock();
    client.auth.admin.listUsers
      .mockResolvedValueOnce({ data: { users: Array(PAGE_SIZE).fill({}) }, error: null })
      .mockResolvedValueOnce({ data: { users: [] }, error: null });
    await expect(listAllUsers(client)).resolves.toHaveLength(PAGE_SIZE);
  });
});
