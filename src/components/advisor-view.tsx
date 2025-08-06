"use client";

import React, { useState, useContext, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppContext } from "@/context/app-context";
import { askFinancialAdvisor } from "@/ai/flows/ask-financial-advisor";
import { Loader2, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export default function AdvisorView() {
  const { expenses } = useContext(AppContext);
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim() || !user) return;

    const userMessage: Message = { role: 'user', content: input };
    const newConversation = [...conversation, userMessage];
    setConversation(newConversation);
    setInput('');
    setLoading(true);
    setError(null);
    
    const relevantExpenses = expenses.slice(0, 50).map(e => ({ category: e.category, amount: e.amount, merchant: e.merchant, date: e.date }));

    try {
        const response = await askFinancialAdvisor({
            question: input,
            expenses: JSON.stringify(relevantExpenses),
            history: conversation, // Pass previous messages
        });
        const assistantMessage: Message = { role: 'assistant', content: response.answer };
        setConversation(prev => [...prev, assistantMessage]);

    } catch (e) {
      setError("Failed to get response from advisor. Please try again.");
      console.error(e);
      // Rollback optimistic update on error
      setConversation(conversation);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [conversation]);
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
        <Card className="flex-1 flex flex-col">
            <CardHeader>
                <CardTitle>AI Financial Advisor</CardTitle>
                <CardDescription>Ask me anything about your finances. I'll remember our conversation.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {conversation.length === 0 && (
                             <div className="flex h-full items-center justify-center text-muted-foreground">
                                Start a conversation by typing your question below.
                             </div>
                        )}
                        {conversation.map((message, index) => (
                        <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                            {message.role === 'assistant' && (
                                <Avatar className="w-8 h-8 border">
                                    <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`rounded-lg p-3 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            {message.role === 'user' && user && (
                                <Avatar className="w-8 h-8 border">
                                     <AvatarImage src={user.photoURL ?? "https://placehold.co/40x40.png"} alt="User" data-ai-hint="person avatar" />
                                    <AvatarFallback>{user.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                        ))}
                         {loading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="w-8 h-8 border">
                                    <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg p-3 bg-muted">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                {error && (
                    <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="relative mt-auto">
                    <Textarea 
                        placeholder="e.g., How can I save more on groceries?"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pr-16"
                        disabled={loading}
                    />
                     <Button 
                        type="submit" 
                        size="icon" 
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={handleSendMessage}
                        disabled={loading || !input.trim()}
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                        <span className="sr-only">Send</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
