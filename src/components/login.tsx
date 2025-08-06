"use client";

// import { auth } from "@/lib/firebase";
// import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
// import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { Coins } from "lucide-react";

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
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 text-center shadow-lg w-full max-w-md">
         <div className="relative mb-4">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="url(#paint0_linear_1_2)"/>
            <path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" stroke="url(#paint1_linear_1_2)" strokeWidth="1.5"/>
            <path d="M12 11.5V12.5C12 13.0523 11.5523 13.5 11 13.5H10.5M12 11.5C12.5523 11.5 13 11.0523 13 10.5V9.5C13 8.94772 12.5523 8.5 12 8.5C11.4477 8.5 11 8.94772 11 9.5V10.5C11 11.0523 11.4477 11.5 12 11.5Z" stroke="url(#paint2_linear_1_2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="paint0_linear_1_2" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--primary))"/>
                <stop offset="1" stopColor="hsl(var(--primary) / 0.5)"/>
              </linearGradient>
              <linearGradient id="paint1_linear_1_2" x1="12" y1="7" x2="12" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(var(--primary))"/>
                <stop offset="1" stopColor="hsl(var(--primary) / 0.7)"/>
              </linearGradient>
              <linearGradient id="paint2_linear_1_2" x1="11.5" y1="8.5" x2="11.5" y2="13.5" gradientUnits="userSpaceOnUse">
                 <stop stopColor="hsl(var(--primary))"/>
                <stop offset="1" stopColor="hsl(var(--primary) / 0.7)"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-card-foreground font-headline">Welcome to FinTrack AI</h1>
        <p className="text-muted-foreground">Your intelligent assistant for personal finance management.</p>
        <Button onClick={handleGoogleSignIn} className="mt-6" size="lg">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025A20.02 20.02 0 0 0 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.487 44 30.825 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
