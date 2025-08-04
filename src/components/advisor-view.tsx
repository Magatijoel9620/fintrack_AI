"use client";

import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppContext } from "@/context/app-context";
import { analyzeSpendingHabits } from "@/ai/flows/analyze-spending-habits";
import { Lightbulb, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type AnalysisResult = {
  analysis: string;
  savingsStrategies: string;
};

export default function AdvisorView() {
  const { expenses } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const relevantExpenses = expenses.slice(0, 50).map(e => ({ category: e.category, amount: e.amount }));

    try {
      const analysisResult = await analyzeSpendingHabits({
        expenses: JSON.stringify(relevantExpenses),
      });
      setResult(analysisResult);
    } catch (e) {
      setError("Failed to get analysis. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Financial Advisor</CardTitle>
          <CardDescription>
            Get personalized insights and savings strategies based on your spending habits.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
            <Button onClick={handleAnalyze} disabled={loading} size="lg">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="mr-2 h-4 w-4" />
              )}
              Analyze My Spending
            </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Spending Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {result.analysis.split('\n').map((paragraph, i) => (
                        <p key={i} className="text-muted-foreground">{paragraph}</p>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Savings Strategies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {result.savingsStrategies.split('\n').map((strat, i) => {
                        if(strat.trim().startsWith('-')) {
                            return <div key={i} className="flex items-start"><span className="mr-2 mt-1">-</span><p className="text-muted-foreground">{strat.trim().substring(1).trim()}</p></div>;
                        }
                        return <p key={i} className="font-semibold">{strat}</p>
                    })}
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
