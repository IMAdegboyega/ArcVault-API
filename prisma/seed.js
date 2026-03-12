const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ArcVault database...\n');

  // Clean existing data
  await prisma.transfer.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  const passwordHash = await bcrypt.hash('Password123', 12);

  const user1 = await prisma.user.create({
    data: {
      email: 'tommy@arcvault.dev',
      passwordHash,
      firstName: 'Tommy',
      lastName: 'Dev',
      address1: '123 Main St',
      city: 'Lagos',
      state: 'LA',
      postalCode: '10001',
      dateOfBirth: '1995-01-15',
      ssn: '1234',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane@arcvault.dev',
      passwordHash,
      firstName: 'Jane',
      lastName: 'Smith',
      address1: '456 Oak Ave',
      city: 'New York',
      state: 'NY',
      postalCode: '10002',
      dateOfBirth: '1992-06-20',
      ssn: '5678',
    },
  });

  console.log('✅ Created test users');

  // Create mock bank accounts
  const account1 = await prisma.bankAccount.create({
    data: {
      userId: user1.id,
      plaidItemId: 'mock_item_1',
      plaidAccessToken: 'mock_access_token_1',
      accountId: 'mock_account_checking_1',
      name: 'Plaid Checking',
      officialName: 'Plaid Gold Standard Checking',
      type: 'depository',
      subtype: 'checking',
      mask: '0000',
      currentBalance: 12500.50,
      availableBalance: 12000.00,
      shareableId: Buffer.from('mock_account_checking_1').toString('base64'),
    },
  });

  const account2 = await prisma.bankAccount.create({
    data: {
      userId: user1.id,
      plaidItemId: 'mock_item_1',
      plaidAccessToken: 'mock_access_token_1',
      accountId: 'mock_account_savings_1',
      name: 'Plaid Savings',
      officialName: 'Plaid Silver Standard Savings',
      type: 'depository',
      subtype: 'savings',
      mask: '1111',
      currentBalance: 45000.00,
      availableBalance: 45000.00,
      shareableId: Buffer.from('mock_account_savings_1').toString('base64'),
    },
  });

  const account3 = await prisma.bankAccount.create({
    data: {
      userId: user2.id,
      plaidItemId: 'mock_item_2',
      plaidAccessToken: 'mock_access_token_2',
      accountId: 'mock_account_checking_2',
      name: 'Chase Checking',
      officialName: 'Chase Total Checking',
      type: 'depository',
      subtype: 'checking',
      mask: '2222',
      currentBalance: 8750.25,
      availableBalance: 8500.00,
      shareableId: Buffer.from('mock_account_checking_2').toString('base64'),
    },
  });

  console.log('✅ Created mock bank accounts');

  // Create mock transactions
  const categories = ['Food and Drink', 'Shopping', 'Transfer', 'Travel', 'Entertainment', 'Bills', 'Income'];
  const merchants = [
    { name: 'Spotify', category: 'Entertainment', amount: 9.99 },
    { name: 'Amazon', category: 'Shopping', amount: 45.67 },
    { name: 'Uber', category: 'Travel', amount: 23.50 },
    { name: 'Netflix', category: 'Entertainment', amount: 15.99 },
    { name: 'Starbucks', category: 'Food and Drink', amount: 6.75 },
    { name: 'Electric Company', category: 'Bills', amount: 125.00 },
    { name: 'Salary Deposit', category: 'Income', amount: -3500.00 },
    { name: 'Grocery Store', category: 'Food and Drink', amount: 87.32 },
    { name: 'Gas Station', category: 'Travel', amount: 52.10 },
    { name: 'Restaurant', category: 'Food and Drink', amount: 34.50 },
    { name: 'Phone Bill', category: 'Bills', amount: 85.00 },
    { name: 'Gym Membership', category: 'Shopping', amount: 49.99 },
  ];

  const now = new Date();
  const transactions = [];

  for (let i = 0; i < 30; i++) {
    const merchant = merchants[i % merchants.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    transactions.push({
      bankAccountId: i % 3 === 0 ? account2.id : account1.id,
      name: merchant.name,
      amount: merchant.amount + (Math.random() * 10 - 5),
      date,
      category: merchant.category,
      channel: Math.random() > 0.3 ? 'online' : 'in store',
      pending: Math.random() > 0.9,
      merchantName: merchant.name,
      paymentChannel: Math.random() > 0.3 ? 'online' : 'in store',
    });
  }

  await prisma.transaction.createMany({ data: transactions });
  console.log(`✅ Created ${transactions.length} mock transactions`);

  // Create a mock transfer
  await prisma.transfer.create({
    data: {
      senderUserId: user1.id,
      senderAccountId: account1.id,
      receiverUserId: user2.id,
      receiverAccountId: account3.id,
      amount: 250.00,
      description: 'Rent split',
      status: 'COMPLETED',
      email: user2.email,
    },
  });

  console.log('✅ Created mock transfer');

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Test credentials:');
  console.log('   Email: tommy@arcvault.dev');
  console.log('   Password: Password123');
  console.log('   Email: jane@arcvault.dev');
  console.log('   Password: Password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
