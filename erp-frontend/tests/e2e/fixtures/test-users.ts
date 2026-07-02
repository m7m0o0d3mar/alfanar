export const TEST_USERS = {
  admin: {
    email: 'test-admin@erp-test.local',
    password: 'TestAdmin@2024!',
    role: 'admin',
    name: 'Test Admin',
  },
  projectManager: {
    email: 'test-pm@erp-test.local',
    password: 'TestPM@2024!',
    role: 'project_manager',
    name: 'Test PM',
  },
  engineer: {
    email: 'test-eng@erp-test.local',
    password: 'TestEng@2024!',
    role: 'engineer',
    name: 'Test Engineer',
  },
  hse: {
    email: 'test-hse@erp-test.local',
    password: 'TestHSE@2024!',
    role: 'hse',
    name: 'Test HSE',
  },
  client: {
    email: 'test-client@erp-test.local',
    password: 'TestClient@2024!',
    role: 'client',
    name: 'Test Client',
  },
  finance: {
    email: 'test-fin@erp-test.local',
    password: 'TestFin@2024!',
    role: 'finance',
    name: 'Test Finance',
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

export function getTestUser(role: TestUserRole) {
  return TEST_USERS[role];
}
