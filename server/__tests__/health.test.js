const request = require('supertest');
const app = require('../app');

describe('Health Check', () => {
  it('GET /api/v1/health returns 200 with correct shape', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.timestamp).toBeDefined();
    expect(res.body.message).toBe('Server is running');
  });

  it('GET /api/v1/unknown returns 404', async () => {
    const res = await request(app).get('/api/v1/unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
