
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ShieldCheck } from 'lucide-react';

const AdminView = () => {
  return (
    <div className="grid gap-6">
      <Card className="bg-gradient-to-br from-card to-muted/30">
        <CardHeader className="flex flex-row items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle>Admin Panel</CardTitle>
            <CardDescription>Manage application settings and user access.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
                <AvatarImage src="https://placehold.co/80x80.png" alt="Admin" data-ai-hint="person avatar" />
                <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <div>
                <h3 className="text-lg font-semibold">Admin User</h3>
                <p className="text-sm text-muted-foreground">admin@fintrack.ai</p>
                <Button variant="outline" size="sm" className="mt-2">Edit Profile</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View and manage application users.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Search for a user by email.</p>
                <div className="flex gap-2">
                    <Input placeholder="user@example.com" className="w-auto" />
                    <Button>Search</Button>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
           <CardDescription>Configure global settings for the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium">Enable Feature Flags</h4>
                    <p className="text-sm text-muted-foreground">Turn new features on or off globally.</p>
                </div>
                <Button variant="secondary">Manage Flags</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium">API Keys</h4>
                    <p className="text-sm text-muted-foreground">Manage third-party API integrations.</p>
                </div>
                <Button variant="secondary">Configure Keys</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminView;
