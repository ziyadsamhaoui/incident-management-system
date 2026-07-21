// Simulate concurrent execution pressure to verify rate-limiting

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics

const authRateLimitHits = new Rate('auth_429_rate');
const incidentRateLimitHits = new Rate('incident_429_rate');
const retryAfterValues = new Trend('retry_after_seconds');

// Test configuration

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    // Ramp up to target VUs
    { duration: '5s', target: __ENV.VUS ? parseInt(__ENV.VUS) : 2 },
    // Stay at target VUs
    { duration: __ENV.DURATION || '30s', target: __ENV.VUS ? parseInt(__ENV.VUS) : 2 },
    // Ramp down
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    // We expect SOME 429s because we'll exceed rate limits
    'auth_429_rate': ['rate>0'],
    'incident_429_rate': ['rate>0'],
    // All requests should complete (no timeouts)
    http_req_duration: ['p(95)<2000'],
    // No more than 1% error rate for non-429 errors
    'http_req_failed{expected_response:true}': ['rate<0.01'],
  },
};

// Test data

const authPayloads = {
  sousChef: JSON.stringify({
    matricule: '1001',
    firstName: 'Alice',
    lastName: 'Martin',
  }),
  chefAtelier: JSON.stringify({
    matricule: '2001',
    firstName: 'Bob',
    lastName: 'Smith',
    password: 'correctPassword',
  }),
  admin: JSON.stringify({
    email: 'admin@example.com',
    password: 'adminPass',
  }),
};

const incidentCreationPayload = JSON.stringify({
  userId: 1,
  departmentId: 1,
  stationId: 1,
  categoryId: 1,
  priority: 'HIGH',
  description: 'Load test incident — rate limit verification',
});

// Helper: Check Retry-After header

function checkRetryAfterHeader(response) {
  const retryAfter = response.headers['Retry-After'];
  if (retryAfter !== undefined) {
    const retryAfterNum = parseInt(retryAfter);
    if (!isNaN(retryAfterNum)) {
      retryAfterValues.add(retryAfterNum);
    }
    return !isNaN(retryAfterNum) && retryAfterNum > 0;
  }
  return false;
}

// Main test function

export default function () {
  // Use different client identifiers per VU to simulate independent clients
  const vuId = __VU; // k6 built-in: virtual user ID (1-based)

  // Scenario 1: Auth endpoint rate limiting (5 req/min/IP)

  group('Auth Rate Limit — POST /api/auth/login', () => {
    // Send 7 requests rapidly (5 should succeed, 2+ should hit 429)
    for (let i = 0; i < 7; i++) {
      const payload = authPayloads.sousChef;
      const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'auth_login', vu: `${vuId}` },
      });

      if (res.status === 200) {
        check(res, {
          'auth [200] login succeeded': (r) => r.status === 200,
          'auth [200] has accessToken': (r) => {
            try {
              return JSON.parse(r.body).accessToken !== undefined;
            } catch (_) {
              return false;
            }
          },
        });
      } else if (res.status === 429) {
        authRateLimitHits.add(1);
        const hasRetryAfter = checkRetryAfterHeader(res);
        check(res, {
          'auth [429] has Retry-After header': () => hasRetryAfter,
          'auth [429] error type is Too Many Requests': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.error === 'Too Many Requests';
            } catch (_) {
              return false;
            }
          },
        });
      }

      // Small delay between requests to simulate real traffic
      sleep(0.1);
    }
  });

  // Scenario 2: Incident creation rate limiting (10 req/min/client)

  group('Incident Rate Limit — POST /api/incidents', () => {
    // First authenticate to get a valid token
    const authRes = http.post(`${BASE_URL}/api/auth/login`, authPayloads.chefAtelier, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login_token' },
    });

    let authToken = '';
    if (authRes.status === 200) {
      try {
        authToken = JSON.parse(authRes.body).accessToken;
      } catch (_) {
        // Continue without token if auth fails (will get 401)
      }
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Send 14 requests rapidly (10 should succeed, 4+ should hit 429)
    for (let i = 0; i < 14; i++) {
      const res = http.post(`${BASE_URL}/api/incidents`, incidentCreationPayload, {
        headers: headers,
        tags: { name: 'incident_create', vu: `${vuId}` },
      });

      if (res.status === 200 || res.status === 201) {
        check(res, {
          'incident [2xx] creation accepted': (r) => r.status >= 200 && r.status < 300,
        });
      } else if (res.status === 429) {
        incidentRateLimitHits.add(1);
        const hasRetryAfter = checkRetryAfterHeader(res);
        check(res, {
          'incident [429] has Retry-After header': () => hasRetryAfter,
          'incident [429] error type is Too Many Requests': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.error === 'Too Many Requests';
            } catch (_) {
              return false;
            }
          },
        });
      }

      sleep(0.1);
    }
  });

  // Scenario 3: Burst test — send requests as fast as possible

  group('Burst test — rapid-fire auth requests', () => {
    // Send 10 requests in rapid succession with no delay
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push([
        'POST',
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({
          matricule: `${1000 + vuId}`,
          firstName: 'Burst',
          lastName: 'Test',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ]);
    }

    const responses = http.batch(requests);

    let twoHundredCount = 0;
    let fourTwentyNineCount = 0;

    responses.forEach((res) => {
      if (res.status === 200) {
        twoHundredCount++;
      } else if (res.status === 429) {
        fourTwentyNineCount++;
        const hasRetryAfter = checkRetryAfterHeader(res);
        check(res, {
          'burst [429] has Retry-After header': () => hasRetryAfter,
        });
        authRateLimitHits.add(1);
      }
    });

    check(responses[0], {
      'burst: some requests succeed (200) and some are throttled (429)': () =>
        twoHundredCount > 0 && fourTwentyNineCount > 0,
    });
  });
}
