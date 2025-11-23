const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('Creating superadmin user...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('Czl914816', 10);
    
    // Check if user already exists by email
    const existingUser = await prisma.user.findUnique({
      where: { email: 'zack@ampere.com.sg' }
    });
    
    if (existingUser) {
      console.log('User already exists. Updating password and role...');
      
      // Update existing user
      const updatedUser = await prisma.user.update({
        where: { email: 'zack@ampere.com.sg' },
        data: {
          password: hashedPassword,
          role: 'SUPERADMIN',
          name: 'Zack'
        }
      });
      
      console.log('✅ User updated successfully!');
      console.log('Email:', updatedUser.email);
      console.log('Name:', updatedUser.name);
      console.log('Role:', updatedUser.role);
    } else {
      console.log('Creating new user...');
      
      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email: 'zack@ampere.com.sg',
          password: hashedPassword,
          name: 'Zack',
          role: 'SUPERADMIN'
        }
      });
      
      console.log('✅ Superadmin user created successfully!');
      console.log('Email:', newUser.email);
      console.log('Name:', newUser.name);
      console.log('Role:', newUser.role);
    }
    
    console.log('\n=================================');
    console.log('Login Credentials:');
    console.log('=================================');
    console.log('Email: zack@ampere.com.sg');
    console.log('Password: Czl914816');
    console.log('=================================\n');
    
  } catch (error) {
    console.error('Error creating superadmin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

