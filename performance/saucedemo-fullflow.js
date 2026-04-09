import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,           // 20 concurrent users
  duration: '30s',   // all run together for 30 seconds
};

export default function () {

  // STEP 1 — Open login page
  let res = http.get('https://www.saucedemo.com/');
  check(res, { 'login page loaded': (r) => r.status === 200 });

  sleep(1);

  // STEP 2 — Submit login
  const payload = {
    'user-name': 'standard_user',
    'password': 'secret_sauce',
  };

  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  res = http.post('https://www.saucedemo.com/', payload, params);
  check(res, { 'login successful': (r) => r.status === 200 });

  sleep(1);

  // STEP 3 — Load inventory page
  res = http.get('https://www.saucedemo.com/inventory.html');
  check(res, { 'inventory loaded': (r) => r.status === 200 });

  sleep(1);
}