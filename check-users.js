// Quick script to check users in production database
const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
  });

  try {
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      take: 10
    });

    console.log(`Total users: ${userCount}`);
    console.log('Recent users:', users);

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();