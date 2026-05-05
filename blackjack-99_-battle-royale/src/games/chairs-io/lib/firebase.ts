import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../../lib/firebase';

export { auth, db, googleProvider };

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
