const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'users.json');

const user = {
    id: 'usr_' + Date.now(),
    username: 'vaibhav',
    email: 'vaibhav@test.com',
    password: '1234',
    approved: true,
    subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastLogin: null,
    createdAt: new Date().toISOString()
};

const data = { users: [user] };
fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));

console.log('✅ User created successfully!');
console.log('────────────────────────');
console.log('Username: vaibhav');
console.log('Password: 1234');
console.log('Valid for: 30 days');
console.log('────────────────────────');
console.log('File saved at: ' + USERS_FILE);
