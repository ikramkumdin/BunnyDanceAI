/**
 * Migration script to add imageCredits and videoCredits to existing users
 * Run this once to migrate existing users to the new credit system
 * 
 * Usage: npx tsx scripts/migrate-user-credits.ts
 */

import { adminDb } from '../lib/firebase-admin';

const FREE_IMAGE_CREDITS = 3;
const FREE_VIDEO_CREDITS = 3;

async function migrateUserCredits() {
  console.log('🚀 Starting user credits migration...');
  
  try {
    const usersRef = adminDb.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('No users found in database');
      return;
    }

    console.log(`Found ${snapshot.size} users to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      
      // Skip if user already has the new credit fields
      if (userData.imageCredits !== undefined && userData.videoCredits !== undefined) {
        skippedCount++;
        continue;
      }

      try {
        // Determine credits based on tier
        let imageCredits = FREE_IMAGE_CREDITS;
        let videoCredits = FREE_VIDEO_CREDITS;

        // Pro and lifetime users get unlimited (represented by a large number)
        if (userData.tier === 'pro' || userData.tier === 'lifetime') {
          // Pro/lifetime users don't need credit tracking (checked in code)
          // But we'll set them to 0 since the code checks tier first
          imageCredits = 0;
          videoCredits = 0;
        }

        // Update the user document
        batch.update(doc.ref, {
          imageCredits,
          videoCredits,
        });

        batchCount++;
        migratedCount++;

        // Commit batch if we've reached the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Error migrating user ${doc.id}:`, error);
        errorCount++;
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateUserCredits()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
