"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { getClientAuth, getClientDb } from "./firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
  getAuthenticatedUser: () => Promise<FirebaseUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getAuthenticatedUser: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getClientAuth();
    const db = getClientDb();
    if (!auth) {
      setLoading(false);
      return; // no-op on server
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Create user document in Firestore if it doesn't exist
        try {
          if (db) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                email: user.email,
                createdAt: new Date(),
              });
            }
          }
        } catch (e) {
          // ignore firestore write errors in auth listener
          console.error("Error ensuring user doc:", e);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (email: string, pass: string) => {
    const auth = getClientAuth();
    if (!auth) return Promise.reject(new Error("Auth not available"));
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signOut = async () => {
    const auth = getClientAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
  };
  
  const getAuthenticatedUser = async (): Promise<FirebaseUser | null> => {
    const auth = getClientAuth();
    if (!auth) return null;
    // @ts-ignore - compat helper may exist
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
    return auth.currentUser;
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, getAuthenticatedUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
