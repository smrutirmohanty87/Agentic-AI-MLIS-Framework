import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,          // 20 concurrent users
  duration: '30s',  // run for 30 seconds
};

export default function () {
  const res = http.get('https://www.saucedemo.com/');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}