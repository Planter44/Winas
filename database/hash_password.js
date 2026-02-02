const bcrypt = require('bcrypt');

const password = 'Password@0609';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Password:', password);
  console.log('Hash:', hash);
});
