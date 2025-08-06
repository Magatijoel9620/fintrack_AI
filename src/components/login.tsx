"use client";

// import { auth } from "@/lib/firebase";
// import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
// import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { CircleDollarSign } from "lucide-react";

export default function Login() {
  // const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    // const provider = new GoogleAuthProvider();
    // try {
    //   await signInWithPopup(auth, provider);
    // } catch (error) {
    //   console.error("Error during Google sign-in:", error);
    // }
  };

  // useEffect(() => {
  //   if (user) {
  //     router.push("/dashboard");
  //   }
  // }, [user, router]);
  
  // if (loading) {
  //   return <div>Loading...</div>
  // }
  
  // if (user) {
  //   return null;
  // }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 shadow-lg">
         <CircleDollarSign className="w-16 h-16 text-primary" />
        <h1 className="text-3xl font-bold text-card-foreground">FinTrack AI</h1>
        <p className="text-muted-foreground">Your personal finance assistant.</p>
        <Button onClick={handleGoogleSignIn} className="mt-4">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
