"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth, db } from "./firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Create user document in Firestore if it doesn't exist
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                createdAt: new Date(),
            });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };
  
  const getAuthenticatedUser = async (): Promise<FirebaseUser | null> => {
    await auth.authStateReady();
    return auth.currentUser;
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


// Server-side helper to get authenticated user in Server Actions
export async function getAuthenticatedUser(): Promise<FirebaseUser> {
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { headers } = await import('next/headers');
    const { adminConfig } = await import('./firebase/admin');

    const apps = getApps();
    if (!apps.length) {
        initializeApp(adminConfig);
    }

    const idToken = headers().get('Authorization')?.split('Bearer ')[1];
    
    if (!idToken) {
        throw new Error('No authentication token provided.');
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken as FirebaseUser;
    } catch (error) {
        throw new Error('Invalid or expired authentication token.');
    }
}
