import mongoose from 'mongoose';
import config from '../src/config';
import AskQuestion from '../src/app/modules/ask-question/ask-question.model';
import { User } from '../src/app/modules/user/user.model';

async function syncRoles() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(config.database_url as string);
    console.log('Connected!');

    const questions = await AskQuestion.find({ userRole: { $exists: false } });
    console.log(`Found ${questions.length} questions without userRole.`);

    for (const question of questions) {
      const user = await User.findById(question.userId);
      if (user) {
        question.userRole = user.role as 'BROTHER' | 'SISTER';
        await question.save();
        console.log(`Synced role ${user.role} for question ${question._id}`);
      } else {
        console.log(`User not found for question ${question._id}`);
      }
    }

    console.log('Sync completed successfully!');
  } catch (error) {
    console.error('Error syncing roles:', error);
  } finally {
    await mongoose.disconnect();
  }
}

syncRoles();
