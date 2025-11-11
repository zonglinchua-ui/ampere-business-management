const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyAndFixPassword() {
  try {
    console.log('🔍 Checking user and password...\n');
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: 'zack@ampere.com.sg' }
    });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Current password hash: ${user.password.substring(0, 20)}...`);
    console.log('');
    
    // Test if current password works
    const password = 'Czl914816';
    const isValid = await bcrypt.compare(password, user.password);
    
    console.log(`🔐 Testing password "Czl914816"...`);
    console.log(`   Result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log('');
    
    if (!isValid) {
      console.log('🔧 Password hash is incorrect. Generating new hash...');
      
      // Generate new hash
      const newHash = await bcrypt.hash(password, 10);
      console.log(`   New hash: ${newHash.substring(0, 20)}...`);
      console.log('');
      
      // Update user
      await prisma.user.update({
        where: { email: 'zack@ampere.com.sg' },
        data: { password: newHash }
      });
      
      console.log('✅ Password updated successfully!');
      console.log('');
      
      // Verify the new password
      const user2 = await prisma.user.findUnique({
        where: { email: 'zack@ampere.com.sg' }
      });
      
      const isValid2 = await bcrypt.compare(password, user2.password);
      console.log(`🔐 Verifying new password...`);
      console.log(`   Result: ${isValid2 ? '✅ VALID' : '❌ STILL INVALID'}`);
      console.log('');
    }
    
    console.log('========================================');
    console.log('Summary:');
    console.log('Email: zack@ampere.com.sg');
    console.log('Password: Czl914816');
    console.log('Status: ' + (isValid ? 'Already working' : 'Fixed!'));
    console.log('========================================');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAndFixPassword();

