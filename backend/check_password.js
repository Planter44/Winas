const bcrypt = require('bcrypt');

const testPassword = 'Admin@0010';
const hash = '$2b$10$g2vZ8qYxK9YwX9L0M3B9qOy7eXqJmVxK5YwX9L0M3B9qOy7eXqJmV';

bcrypt.compare(testPassword, hash, (err, result) => {
  console.log('Password matches:', result);
});

// Generate new hash
bcrypt.hash(testPassword, 10, (err, newHash) => {
  console.log('New hash for Admin@0010:', newHash);
});
