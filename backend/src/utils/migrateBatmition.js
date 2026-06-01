const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Turf = require('../models/Turf');

// Load env variables
dotenv.config();

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI is not defined in environment variables.');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    // Search for turfs with the typo "Batmition" (case-insensitive) in name, description, or sportType
    console.log('Searching for turfs with "Batmition" typos...');
    
    const matchingTurfs = await Turf.find({
      $or: [
        { sportType: /batmition/i },
        { name: /batmition/i },
        { description: /batmition/i }
      ]
    });

    console.log(`Found ${matchingTurfs.length} turf(s) with matching typos.`);

    let updatedCount = 0;
    for (const turf of matchingTurfs) {
      console.log(`Updating Turf ID: ${turf._id}`);
      console.log(`- Old Name: "${turf.name}"`);
      console.log(`- Old SportType: "${turf.sportType}"`);
      
      // Fix sportType
      if (turf.sportType && /batmition/i.test(turf.sportType)) {
        turf.sportType = 'Badminton';
      }
      
      // Fix name
      if (turf.name && /batmition/i.test(turf.name)) {
        // Maintain matching case pattern
        turf.name = turf.name.replace(/batmition/gi, 'Badminton');
      }

      // Fix description
      if (turf.description && /batmition/i.test(turf.description)) {
        turf.description = turf.description.replace(/batmition/gi, 'Badminton');
      }

      await turf.save();
      console.log(`- Updated successfully! New SportType: "${turf.sportType}"`);
      updatedCount++;
    }

    console.log(`Migration completed! Successfully updated ${updatedCount} arena record(s).`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
