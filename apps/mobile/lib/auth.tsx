import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { DUMMY_PHONE, type Role } from "@ks1j/shared";
import { auth, db } from "./firebase";

export interface Member {
  fullName: string;
  phone: string;
  role: Role;
  sadaatVerified: boolean;
}

interface Ctx {
  user: User | null;
  member: Member | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const off = onAuthStateChanged(auth, (u) => {
      unsub?.();
      setUser(u);
      if (!u) {
        setMember(null);
        setLoading(false);
        return;
      }
      unsub = onSnapshot(
        doc(db, "members", u.uid),
        (s) => {
          setMember(s.exists() ? (s.data() as Member) : null);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });
    return () => {
      off();
      unsub?.();
    };
  }, []);

  const value: Ctx = {
    user,
    member,
    loading,
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signUp(name, email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "members", cred.user.uid), {
        fullName: name,
        phone: DUMMY_PHONE,
        role: "member",
        sadaatVerified: false,
        createdAt: serverTimestamp(),
      });
    },
    signOut: () => fbSignOut(auth),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
